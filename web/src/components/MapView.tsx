import { useEffect, useRef } from 'react';
import { useApp } from '../lib/app';

export interface Marker { lat: number; lng: number; label: string; count?: number; kind?: 'story' | 'incident'; onClick?: () => void }
interface Props { markers: Marker[]; center?: [number, number]; zoom?: number; onMove?: (b: { west: number; south: number; east: number; north: number; zoom: number }) => void; onPick?: (lat: number, lng: number) => void; picked?: [number, number] | null }

let googleLoading: Promise<void> | null = null;
function loadGoogle(key: string): Promise<void> {
  googleLoading ??= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=__mapsReady`;
    s.async = true; s.onerror = () => rej(new Error('maps'));
    (window as any).__mapsReady = () => res();
    document.head.appendChild(s);
  });
  return googleLoading;
}

/**
 * The map used by “Where It Happened”, Map Explore, incident pages and the place picker.
 * With a Google Maps key it uses Google Maps (Section 3.4). Without one (for example on test hosting) it draws the same
 * markers on a simple built-in map of Kenya’s coast and lakes, so the feature still works.
 */
export function MapView(p: Props) {
  const { config } = useApp();
  const el = useRef<HTMLDivElement>(null);
  const state = useRef<{ map?: any; markers: any[]; pick?: any }>({ markers: [] });
  const key = config?.mapsKey;

  useEffect(() => {
    if (!key || !el.current) return;
    let dead = false;
    void loadGoogle(key).then(() => {
      if (dead || !el.current) return;
      const g = (window as any).google.maps;
      const map = state.current.map ?? new g.Map(el.current, { center: { lat: p.center?.[0] ?? -1.3, lng: p.center?.[1] ?? 37.2 }, zoom: p.zoom ?? 6, mapTypeControl: false, streetViewControl: false, fullscreenControl: false });
      state.current.map = map;
      state.current.markers.forEach((m) => m.setMap(null));
      state.current.markers = p.markers.map((m) => {
        const mk = new g.Marker({ map, position: { lat: m.lat, lng: m.lng }, title: m.label, label: m.count && m.count > 1 ? { text: String(m.count), color: '#fff', fontWeight: '700' } : undefined,
          icon: { path: g.SymbolPath.CIRCLE, scale: m.count && m.count > 1 ? 15 : 9, fillColor: m.kind === 'incident' ? '#c9302c' : '#0b5fbf', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 } });
        if (m.onClick) mk.addListener('click', m.onClick);
        return mk;
      });
      if (p.onMove && !map.__moveBound) {
        map.__moveBound = true;
        map.addListener('idle', () => { const b = map.getBounds(); if (b) p.onMove!({ west: b.getSouthWest().lng(), south: b.getSouthWest().lat(), east: b.getNorthEast().lng(), north: b.getNorthEast().lat(), zoom: map.getZoom() }); });
      }
      if (p.onPick && !map.__pickBound) { map.__pickBound = true; map.addListener('click', (e: any) => p.onPick!(e.latLng.lat(), e.latLng.lng())); }
      state.current.pick?.setMap(null);
      if (p.picked) state.current.pick = new g.Marker({ map, position: { lat: p.picked[0], lng: p.picked[1] } });
    }).catch(() => undefined);
    return () => { dead = true; };
  }, [key, p.markers, p.picked, p.center, p.zoom, p.onMove, p.onPick]);

  if (key) return <div className="mapbox" ref={el} role="application" aria-label="Map" />;
  return <SimpleMap {...p} />;
}

// Built-in map: an outline of Kenya’s waters drawn to scale, enough to place markers when no map service is connected.
const BOX = { west: 33.6, east: 42.0, south: -5.0, north: 5.2 };
const WATERS: Array<{ name: string; d: Array<[number, number]>; closed?: boolean }> = [
  { name: 'Indian Ocean', closed: true, d: [[41.6, -1.6], [41.0, -2.0], [40.4, -2.6], [40.1, -3.2], [39.8, -3.9], [39.6, -4.3], [39.2, -4.7], [39.2, -5.0], [42.0, -5.0], [42.0, -1.2]] },
  { name: 'Lake Victoria', closed: true, d: [[33.9, 0.3], [34.3, 0.1], [34.8, -0.1], [34.5, -0.5], [34.2, -0.9], [34.0, -1.1], [33.6, -1.1], [33.6, 0.3]] },
  { name: 'Lake Turkana', closed: true, d: [[35.9, 4.6], [36.2, 4.2], [36.6, 3.2], [36.7, 2.5], [36.5, 2.4], [36.1, 3.2], [35.8, 4.0]] },
  { name: 'Tana River', d: [[37.6, -0.4], [38.6, -0.1], [39.5, -0.5], [39.9, -1.5], [40.1, -2.2], [40.5, -2.5]] },
];
function SimpleMap(p: Props) {
  const W = 420, H = 510;
  const x = (lng: number) => ((lng - BOX.west) / (BOX.east - BOX.west)) * W, y = (lat: number) => ((BOX.north - lat) / (BOX.north - BOX.south)) * H;
  const moved = useRef(false);
  useEffect(() => { if (!moved.current) { moved.current = true; p.onMove?.({ ...BOX, zoom: 6 }); } });
  return (
    <div className="mapbox">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" role="img" aria-label="Map of Kenya’s coast, lakes and rivers" style={{ display: 'block', background: 'var(--surface-2)' }}
        onClick={(e) => { if (!p.onPick) return; const r = e.currentTarget.getBoundingClientRect(); p.onPick(BOX.north - ((e.clientY - r.top) / r.height) * (BOX.north - BOX.south), BOX.west + ((e.clientX - r.left) / r.width) * (BOX.east - BOX.west)); }}>
        {WATERS.map((w) => <path key={w.name} d={`M${w.d.map(([lng, lat]) => `${x(lng).toFixed(1)} ${y(lat).toFixed(1)}`).join('L')}${w.closed ? 'Z' : ''}`} fill={w.closed ? 'var(--blue-soft)' : 'none'} stroke="var(--blue-line)" strokeWidth={w.closed ? 1.5 : 3} />)}
        {WATERS.map((w) => <text key={`${w.name}t`} x={x(w.d[0][0]) - (w.name === 'Indian Ocean' ? 40 : 0)} y={y(w.d[0][1]) + (w.name === 'Indian Ocean' ? 60 : -6)} fontSize="11" fill="var(--ink-3)">{w.name}</text>)}
        {p.markers.map((m, i) => (
          <g key={i} transform={`translate(${x(m.lng).toFixed(1)} ${y(m.lat).toFixed(1)})`} onClick={(e) => { e.stopPropagation(); m.onClick?.(); }} style={{ cursor: m.onClick ? 'pointer' : 'default' }} role={m.onClick ? 'button' : undefined} tabIndex={m.onClick ? 0 : undefined}
            onKeyDown={(e) => { if (e.key === 'Enter') m.onClick?.(); }} aria-label={m.label}>
            <title>{m.label}</title>
            <circle r={m.count && m.count > 1 ? 13 : 8} fill={m.kind === 'incident' ? '#c9302c' : '#0b5fbf'} stroke="#fff" strokeWidth="2" />
            {m.count && m.count > 1 && <text textAnchor="middle" dy="4" fontSize="11" fontWeight="700" fill="#fff">{m.count}</text>}
          </g>
        ))}
        {p.picked && <path transform={`translate(${x(p.picked[1])} ${y(p.picked[0])})`} d="M0 0c-7-9-9-12-9-16a9 9 0 0 1 18 0c0 4-2 7-9 16z" fill="#c9302c" stroke="#fff" strokeWidth="1.500" />}
      </svg>
    </div>
  );
}
