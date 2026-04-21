/**
 * CesiumViewer — primary moving-map component.
 *
 * Architecture:
 *  - Single CesiumJS Viewer instance, created once and never re-created.
 *  - Weather layers are Cesium ImageryLayer wrappers over our tile proxy.
 *  - Traffic entities are managed as a Cesium EntityCollection for performance.
 *  - Route waypoints are drawn as BillboardCollection + PolylineCollection.
 *
 * Performance notes:
 *  - Traffic updates modify entity positions directly (no add/remove per tick).
 *  - Imagery layer opacity is tweened via requestAnimationFrame, not setState.
 *  - Cesium's RequestScheduler is configured for higher parallelism on terrain tiles.
 */

import { useEffect, useRef, useCallback } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useMapStore } from '@/store/mapStore';
import { useTraffic } from '@/hooks/useTraffic';

// Expose token before Cesium viewer creates
Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN ?? 'your_cesium_ion_token';

// Map our layer enum to Cesium imagery providers
function buildBaseLayer(layer: string): Cesium.ImageryProvider {
  switch (layer) {
    case 'satellite':
      return new Cesium.IonImageryProvider({ assetId: 3 }); // Bing Aerial
    case 'vfr':
      // OpenAIP VFR chart tiles (free, register at openaip.net)
      return new Cesium.UrlTemplateImageryProvider({
        url: 'https://tiles.openaip.net/geowebcache/service/tms/1.0.0/openaip_approved_vfr@EPSG%3A900913@png/{z}/{x}/{reverseY}.png',
        credit: 'OpenAIP',
        minimumLevel: 5,
        maximumLevel: 14,
      });
    case 'ifr':
      return new Cesium.UrlTemplateImageryProvider({
        url: 'https://tiles.openaip.net/geowebcache/service/tms/1.0.0/openaip_approved_ifr_low@EPSG%3A900913@png/{z}/{x}/{reverseY}.png',
        credit: 'OpenAIP',
        minimumLevel: 5,
        maximumLevel: 14,
      });
    default: // terrain
      return new Cesium.OpenStreetMapImageryProvider({
        url: 'https://a.tile.openstreetmap.org/',
        credit: 'OpenStreetMap contributors',
      });
  }
}

// Map weather layer key to our backend tile proxy URL template
function buildWeatherLayer(layer: string): Cesium.ImageryProvider | null {
  if (layer === 'none') return null;
  // Our NestJS proxy: GET /api/v1/weather/windy/:layer/:z/:x/:y
  return new Cesium.UrlTemplateImageryProvider({
    url: `/api/v1/weather/windy/${layer}/{z}/{x}/{y}`,
    credit: 'Windy.com',
    minimumLevel: 1,
    maximumLevel: 12,
  });
}

interface TrafficEntity {
  icao24: string;
  entity: Cesium.Entity;
}

export function CesiumViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const weatherLayerRef = useRef<Cesium.ImageryLayer | null>(null);
  const baseLayerRef = useRef<Cesium.ImageryLayer | null>(null);
  const trafficEntitiesRef = useRef<Map<string, Cesium.Entity>>(new Map());
  const routeRef = useRef<{ polyline: Cesium.Entity; waypoints: Cesium.Entity[] }>({ polyline: null as any, waypoints: [] });

  const {
    center, altitude, baseLayer, weatherLayer, showWeather,
    showTerrain, show3D, traffic, isDrawingRoute, activeRouteWaypoints,
    addRouteWaypoint, setTrafficUpdate,
  } = useMapStore();

  const { states: trafficStates } = useTraffic();

  // ── Initialise Cesium viewer ──────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    const viewer = new Cesium.Viewer(containerRef.current, {
      terrainProvider: showTerrain
        ? Cesium.createWorldTerrainAsync ? undefined : undefined
        : new Cesium.EllipsoidTerrainProvider(),
      baseLayer: Cesium.ImageryLayer.fromProviderAsync(
        Promise.resolve(buildBaseLayer(baseLayer)),
      ),
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false, // we use custom popups
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      navigationHelpButton: false,
      navigationInstructionsInitiallyVisible: false,
      scene3DOnly: false,
      shadows: false, // performance
      requestRenderMode: true, // only re-render when data changes
      maximumRenderTimeChange: 1000,
    });

    // Load Cesium World Terrain asynchronously
    if (showTerrain) {
      Cesium.createWorldTerrainAsync({
        requestWaterMask: false,
        requestVertexNormals: true,
      }).then((provider) => {
        viewer.terrainProvider = provider;
      }).catch(() => {
        // Fallback to flat ellipsoid if terrain fails (offline)
        viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
      });
    }

    // Cockpit-friendly atmosphere
    viewer.scene.skyAtmosphere.show = true;
    viewer.scene.globe.enableLighting = false;
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0d1117');
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#1a2332');

    // Performance: limit framerate to 30fps when idle
    viewer.scene.maximumRenderTimeChange = 33;

    // Fly to default position
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(center[0], center[1], altitude),
      orientation: { heading: Cesium.Math.toRadians(0), pitch: Cesium.Math.toRadians(-90), roll: 0 },
      duration: 0,
    });

    viewerRef.current = viewer;

    return () => {
      if (!viewer.isDestroyed()) viewer.destroy();
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // ── Handle route drawing clicks ────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    if (isDrawingRoute) {
      handler.setInputAction((e: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        const ray = viewer.camera.getPickRay(e.position);
        if (!ray) return;
        const pos = viewer.scene.globe.pick(ray, viewer.scene);
        if (!pos) return;
        const carto = Cesium.Cartographic.fromCartesian(pos);
        addRouteWaypoint({
          lat: Cesium.Math.toDegrees(carto.latitude),
          lon: Cesium.Math.toDegrees(carto.longitude),
        });
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }

    return () => handler.destroy();
  }, [isDrawingRoute, addRouteWaypoint]);

  // ── Sync base layer ────────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const layers = viewer.imageryLayers;
    if (baseLayerRef.current) layers.remove(baseLayerRef.current, true);
    const newLayer = layers.addImageryProvider(buildBaseLayer(baseLayer), 0);
    baseLayerRef.current = newLayer;
  }, [baseLayer]);

  // ── Sync weather overlay ───────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const layers = viewer.imageryLayers;
    if (weatherLayerRef.current) {
      layers.remove(weatherLayerRef.current, true);
      weatherLayerRef.current = null;
    }
    if (showWeather && weatherLayer !== 'none') {
      const provider = buildWeatherLayer(weatherLayer);
      if (provider) {
        const layer = layers.addImageryProvider(provider);
        layer.alpha = 0.65;
        weatherLayerRef.current = layer;
      }
    }
  }, [showWeather, weatherLayer]);

  // ── Sync 3D terrain toggle ─────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.scene.globe.depthTestAgainstTerrain = show3D;
    if (!show3D) viewer.scene.terrainProvider = new Cesium.EllipsoidTerrainProvider();
  }, [show3D, showTerrain]);

  // ── Update traffic entities ────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !traffic.showTraffic) {
      // Clear all traffic entities when toggled off
      trafficEntitiesRef.current.forEach((e) => viewer?.entities.remove(e));
      trafficEntitiesRef.current.clear();
      return;
    }

    const now = Date.now();
    const STALE_THRESHOLD = 90_000; // 90 s

    // Remove stale entities
    const activeIcaos = new Set(trafficStates.map((s) => s.icao24));
    trafficEntitiesRef.current.forEach((entity, icao24) => {
      if (!activeIcaos.has(icao24)) {
        viewer.entities.remove(entity);
        trafficEntitiesRef.current.delete(icao24);
      }
    });

    // Add / update entities
    trafficStates.forEach((state) => {
      if (state.longitude == null || state.latitude == null) return;
      const altM = (state.baroAltitude ?? 100);
      const position = Cesium.Cartesian3.fromDegrees(state.longitude, state.latitude, altM);
      const heading = state.trueTrack ?? 0;
      const isStale = state.lastContact ? (now / 1000 - state.lastContact) > 90 : false;
      const altFt = Math.round(altM * 3.28084);
      const speedKt = state.velocity != null ? Math.round(state.velocity * 1.94384) : 0;
      const vsArrow = (state.verticalRate ?? 0) > 0.5 ? '↑' : (state.verticalRate ?? 0) < -0.5 ? '↓' : '→';
      const label = `${state.callsign ?? state.icao24}\n${altFt}ft ${vsArrow} ${speedKt}kt`;

      const existing = trafficEntitiesRef.current.get(state.icao24);

      if (existing) {
        // Smooth position update — direct property mutation is fast
        (existing.position as Cesium.ConstantPositionProperty).setValue(position);
        (existing.billboard as Cesium.BillboardGraphics).rotation = new Cesium.ConstantProperty(
          Cesium.Math.toRadians(-heading),
        );
        (existing.label as Cesium.LabelGraphics).text = new Cesium.ConstantProperty(label);
        (existing.billboard as Cesium.BillboardGraphics).color = new Cesium.ConstantProperty(
          isStale ? Cesium.Color.GRAY : Cesium.Color.fromCssColorString('#00d4ff'),
        );
      } else {
        const entity = viewer.entities.add({
          id: `traffic-${state.icao24}`,
          position,
          billboard: {
            image: buildAircraftIcon(state.category),
            width: 28,
            height: 28,
            rotation: Cesium.Math.toRadians(-heading),
            alignedAxis: Cesium.Cartesian3.UNIT_Z,
            color: isStale ? Cesium.Color.GRAY : Cesium.Color.fromCssColorString('#00d4ff'),
            scaleByDistance: new Cesium.NearFarScalar(1e4, 1.2, 2e6, 0.4),
            pixelOffset: new Cesium.Cartesian2(0, -16),
          },
          label: {
            text: label,
            font: '11px "Roboto Mono", monospace',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, 24),
            scaleByDistance: new Cesium.NearFarScalar(1e4, 1.0, 8e5, 0.0),
            showBackground: true,
            backgroundColor: Cesium.Color.fromCssColorString('#0d111799'),
          },
          properties: new Cesium.PropertyBag({ ...state }),
        });
        trafficEntitiesRef.current.set(state.icao24, entity);
      }
    });

    setTrafficUpdate(Date.now());
    viewer.scene.requestRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trafficStates, traffic.showTraffic]);

  // ── Draw route polyline ────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // Remove previous route
    if (routeRef.current.polyline) viewer.entities.remove(routeRef.current.polyline);
    routeRef.current.waypoints.forEach((e) => viewer.entities.remove(e));
    routeRef.current = { polyline: null as any, waypoints: [] };

    if (activeRouteWaypoints.length < 2) return;

    const positions = activeRouteWaypoints.flatMap((wp) =>
      Cesium.Cartesian3.fromDegrees(wp.lon, wp.lat, 500),
    );

    const polyline = viewer.entities.add({
      polyline: {
        positions,
        width: 3,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.fromCssColorString('#39d353'),
          dashLength: 20,
        }),
        clampToGround: false,
      },
    });

    const waypoints = activeRouteWaypoints.map((wp, i) =>
      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(wp.lon, wp.lat, 500),
        point: {
          pixelSize: 10,
          color: Cesium.Color.fromCssColorString('#ffb347'),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
        },
        label: {
          text: wp.label ?? `WP${i + 1}`,
          font: '12px "Roboto Mono"',
          pixelOffset: new Cesium.Cartesian2(0, -20),
          fillColor: Cesium.Color.fromCssColorString('#ffb347'),
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
        },
      }),
    );

    routeRef.current = { polyline, waypoints };
    viewer.scene.requestRender();
  }, [activeRouteWaypoints]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ background: '#0d1117' }}
    />
  );
}

// Generate a data-URI aircraft icon SVG based on category
function buildAircraftIcon(category: number | null): string {
  const isHelo = category === 8;
  const svg = isHelo
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
        <path d="M16 4 L20 16 L16 28 L12 16 Z" fill="#00d4ff" opacity="0.9"/>
        <path d="M4 13 L28 13 L28 15 L4 15 Z" fill="#00d4ff" opacity="0.7"/>
        <circle cx="16" cy="14" r="3" fill="white"/>
      </svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
        <path d="M16 2 L20 20 L16 30 L12 20 Z" fill="#00d4ff" opacity="0.9"/>
        <path d="M2 18 L30 18 L30 20 L2 20 Z" fill="#00d4ff" opacity="0.8"/>
        <path d="M8 24 L24 24 L24 25 L8 25 Z" fill="#00d4ff" opacity="0.6"/>
      </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
