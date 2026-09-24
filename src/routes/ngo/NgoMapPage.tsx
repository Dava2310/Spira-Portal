import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, Loader2, MapPin, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/auth/useAuth';
import { getNgoBases, ngoBasesQueryKey } from '@/features/ngo-profile/_logic';
import {
  distanceLabel,
  findCurrentPosition,
  getShelf,
  shelfQueryKey,
  type ShelfFilters,
  type ShelfPackageVM,
} from '@/features/shelf/_logic';

/** Barcelona, used only until an origin is known. */
const FALLBACK_CENTRE: [number, number] = [41.3874, 2.1686];

/**
 * The shelf on a map.
 *
 * The same data the list shows, arranged the way someone planning a round thinks
 * about it. Only shops the API returned coordinates for can be drawn, and the screen
 * says how many it had to leave off rather than quietly showing fewer pins than the
 * list has rows.
 */
export function NgoMapPage() {
  const { session } = useAuth();
  const recipientId = session?.recipient?.id ?? '';

  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [locating, setLocating] = useState(false);
  const [selected, setSelected] = useState<ShelfPackageVM | null>(null);

  const bases = useQuery({
    queryKey: ngoBasesQueryKey,
    queryFn: () => getNgoBases(recipientId),
    enabled: recipientId !== '',
  });

  const filters = useMemo<ShelfFilters>(
    () => ({ lat: origin?.lat, lng: origin?.lng, limit: 50 }),
    [origin],
  );
  const shelf = useQuery({
    queryKey: shelfQueryKey(filters),
    queryFn: () => getShelf(filters),
  });

  const mapped = (shelf.data?.packages ?? []).filter(
    (item) => item.latitude !== null && item.longitude !== null,
  );

  const locate = async () => {
    setLocating(true);
    setOrigin(await findCurrentPosition());
    setLocating(false);
  };

  const hasBase = (bases.data ?? []).some((base) => base.hasCoordinates);

  return (
    <section className="flex h-[calc(100vh-7.5rem)] flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-brand-brown">Map</h1>
          <p className="mt-0.5 truncate text-xs text-brand-brown/70">
            {shelf.data
              ? `${shelf.data.storesMatching} ${shelf.data.storesMatching === 1 ? 'shop' : 'shops'} with surplus`
              : 'Loading…'}
          </p>
        </div>
        <button
          onClick={() => void locate()}
          disabled={locating}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border-tan px-2.5 py-1.5 text-[11px] font-semibold text-brand-brown transition hover:bg-surface-cream disabled:opacity-60"
        >
          {locating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Crosshair className="h-3.5 w-3.5" />
          )}
          Centre on me
        </button>
      </div>

      <MapCanvas
        packages={shelf.data?.packages ?? []}
        origin={origin}
        onSelect={setSelected}
        selectedId={selected?.locationId ?? null}
      />

      <div className="px-4 pb-4 pt-2">
        {shelf.isPending && (
          <p className="flex items-center gap-2 text-[11px] text-brand-brown/60">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading shops…
          </p>
        )}

        {shelf.data && mapped.length < shelf.data.packages.length && (
          <p className="mb-2 text-[11px] leading-relaxed text-brand-brown/70">
            {shelf.data.packages.length - mapped.length} of{' '}
            {shelf.data.packages.length} shops are not pinned on the map, so
            they only appear in the list.
          </p>
        )}

        {!hasBase && origin === null && !bases.isPending && (
          <p className="mb-2 text-[11px] leading-relaxed text-brand-brown/70">
            Centre on your position, or save a collection base in your profile,
            to see how far each shop is.
          </p>
        )}

        {selected ? (
          <Link
            to={`/ngo/shelf/${selected.locationId}`}
            className="block rounded-2xl border border-border-tan bg-white p-3"
          >
            <p className="flex items-center gap-1 truncate text-sm font-semibold text-brand-ink">
              {selected.retailerName}
              {selected.retailerIsVerified && (
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand-amber" />
              )}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-brand-brown/70">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-brown/40" />
              {selected.storeLabel}
              {distanceLabel(selected.distanceKm) &&
                ` · ${distanceLabel(selected.distanceKm)}`}
            </p>
            <p className="mt-1.5 text-[11px] font-medium text-brand-brown/80">
              {selected.availableCount}{' '}
              {selected.availableCount === 1 ? 'lot' : 'lots'} ·{' '}
              {selected.totalWeightKg} kg · tap to claim
            </p>
          </Link>
        ) : (
          <p className="text-[11px] text-brand-brown/60">
            Tap a pin to see what that shop has.
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * The Leaflet canvas.
 *
 * Leaflet owns its own DOM, so the map is created once and only its marker layer is
 * replaced when the data changes — recreating the map on every render would reset
 * the view under whoever is panning it.
 */
function MapCanvas({
  packages,
  origin,
  onSelect,
  selectedId,
}: {
  packages: ShelfPackageVM[];
  origin: { lat: number; lng: number } | null;
  onSelect: (item: ShelfPackageVM) => void;
  selectedId: string | null;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!container.current || map.current) {
      return;
    }

    const instance = L.map(container.current, {
      // Only the opening view: once markers exist the next effect fits them, and
      // a saved base means the API has already ordered them around the right place.
      center: FALLBACK_CENTRE,
      zoom: 13,
      zoomControl: false,
      attributionControl: true,
    });

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        maxZoom: 19,
        attribution: '© OpenStreetMap, © CARTO',
      },
    ).addTo(instance);

    markers.current = L.layerGroup().addTo(instance);
    map.current = instance;

    return () => {
      instance.remove();
      map.current = null;
      markers.current = null;
    };
    // Created once: Leaflet owns this DOM, and rebuilding it on a data change would
    // reset the view under whoever is panning.
  }, []);

  useEffect(() => {
    const instance = map.current;
    const layer = markers.current;

    if (!instance || !layer) {
      return;
    }

    layer.clearLayers();

    const points: [number, number][] = [];

    if (origin) {
      points.push([origin.lat, origin.lng]);
      L.circleMarker([origin.lat, origin.lng], {
        radius: 7,
        color: '#372506',
        weight: 2,
        fillColor: '#e7a03c',
        fillOpacity: 1,
      })
        .bindTooltip('You', { direction: 'top' })
        .addTo(layer);
    }

    for (const item of packages) {
      if (item.latitude === null || item.longitude === null) {
        continue;
      }

      points.push([item.latitude, item.longitude]);

      const isSelected = item.locationId === selectedId;

      L.marker([item.latitude, item.longitude], {
        icon: L.divIcon({
          className: '',
          html: `<div style="
            display:flex;align-items:center;justify-content:center;
            width:28px;height:28px;border-radius:9999px;
            background:${isSelected ? '#372506' : '#ffffff'};
            color:${isSelected ? '#ffffff' : '#372506'};
            border:2px solid #e7a03c;
            font:600 11px/1 system-ui,sans-serif;
            box-shadow:0 1px 4px rgba(0,0,0,.25);
          ">${item.availableCount}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
        zIndexOffset: isSelected ? 1000 : 100,
      })
        .on('click', () => onSelect(item))
        .bindTooltip(item.retailerName, { direction: 'top' })
        .addTo(layer);
    }

    if (points.length > 1) {
      instance.fitBounds(L.latLngBounds(points).pad(0.25));
    } else if (points.length === 1 && points[0]) {
      instance.setView(points[0], 14);
    }
  }, [packages, origin, onSelect, selectedId]);

  return <div ref={container} className="flex-1" />;
}
