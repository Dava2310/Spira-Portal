import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Loader2, Plus } from 'lucide-react';
import { useState } from 'react';

import {
  createPickupSlot,
  getPickupSlots,
  pickupSlotsQueryKey,
  slotDaysLabel,
} from '@/features/pickup-slots/_logic';

const field =
  'mt-1 w-full rounded-xl border border-border-tan px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-amber';

const WEEKDAYS = [
  { value: '', label: 'Every day' },
  { value: '1', label: 'Mondays' },
  { value: '2', label: 'Tuesdays' },
  { value: '3', label: 'Wednesdays' },
  { value: '4', label: 'Thursdays' },
  { value: '5', label: 'Fridays' },
  { value: '6', label: 'Saturdays' },
  { value: '0', label: 'Sundays' },
];

/**
 * The windows a branch publishes for collections.
 *
 * Worth filling in: a branch with none forces every organization to propose a time
 * and wait to be answered, which is the slowest path through the whole flow.
 */
export function PickupWindowsCard({ locationId }: { locationId: string }) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [weekday, setWeekday] = useState('');
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('20:00');

  const slots = useQuery({
    queryKey: pickupSlotsQueryKey(locationId),
    queryFn: () => getPickupSlots(locationId),
    enabled: locationId !== '',
  });

  const save = useMutation({
    mutationFn: () =>
      createPickupSlot({
        locationId,
        label,
        startTime,
        endTime,
        weekday: weekday === '' ? undefined : Number(weekday),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: pickupSlotsQueryKey(locationId),
      });
      await queryClient.invalidateQueries({ queryKey: ['shelf'] });
      setAdding(false);
      setLabel('');
    },
  });

  const list = slots.data ?? [];

  return (
    <div className="rounded-2xl border border-border-tan bg-white p-3.5">
      <p className="mb-2.5 flex items-center gap-1.5 border-b border-border-tan/60 pb-2.5 text-[11px] font-semibold text-brand-brown/70">
        <Clock className="h-3.5 w-3.5" />
        Collection windows
      </p>

      {slots.isPending ? (
        <p className="py-2 text-[11px] text-brand-brown/60">Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-[11px] leading-relaxed text-brand-brown/70">
          None published. Foodbanks have to propose a time and wait for you to
          agree, which slows every collection down.
        </p>
      ) : (
        <ul className="divide-y divide-border-tan/60">
          {list.map((slot) => (
            <li key={slot.id} className="py-2 first:pt-0">
              <p className="text-xs font-semibold text-brand-ink">
                {slot.label}
              </p>
              <p className="mt-0.5 text-[10px] text-brand-brown/70">
                {slotDaysLabel(slot)} · {slot.windowLabel}
              </p>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
          className="mt-2.5 border-t border-border-tan/60 pt-2.5"
        >
          <input
            required
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Evening collection"
            className={field}
          />
          <select
            value={weekday}
            onChange={(event) => setWeekday(event.target.value)}
            className={field}
          >
            {WEEKDAYS.map((day) => (
              <option key={day.label} value={day.value}>
                {day.label}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] font-medium text-brand-brown/60">
              From
              <input
                required
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className={field}
              />
            </label>
            <label className="text-[10px] font-medium text-brand-brown/60">
              Until
              <input
                required
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className={field}
              />
            </label>
          </div>

          {save.error && (
            <p role="alert" className="mt-2 text-[11px] text-red-700">
              {save.error instanceof Error
                ? save.error.message
                : 'Could not publish that window.'}
            </p>
          )}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="flex-1 rounded-xl border border-border-tan py-2 text-xs font-semibold text-brand-brown"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={save.isPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-amber py-2 text-xs font-semibold text-brand-brown disabled:opacity-60"
            >
              {save.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              Publish
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-brand-brown underline"
        >
          <Plus className="h-3.5 w-3.5" />
          {list.length === 0 ? 'Publish a window' : 'Publish another'}
        </button>
      )}
    </div>
  );
}
