import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { readerPreferencesSchema, type ReaderPreferences } from '@redesk/shared';

const SETTINGS_KEY = 'reader_preferences';

const DEFAULT_PREFERENCES: ReaderPreferences = {
  color_scheme: 'default',
  font_family: 'serif',
  font_size: 18,
  line_height: 1.6,
  custom_fonts: [],
};

function parsePreferences(raw: string | undefined): ReaderPreferences {
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    const parsed = JSON.parse(raw);
    const result = readerPreferencesSchema.safeParse(parsed);
    return result.success ? result.data : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function useReaderPreferences() {
  const qc = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Record<string, string>>('/settings'),
  });

  const rawValue = settingsQuery.data?.[SETTINGS_KEY];
  const [preferences, setPreferences] = useState<ReaderPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    if (settingsQuery.isLoading) return;
    setPreferences(parsePreferences(rawValue));
  }, [rawValue, settingsQuery.isLoading]);

  const saveMutation = useMutation({
    mutationFn: (prefs: ReaderPreferences) =>
      api.patch<Record<string, string>>('/settings', {
        [SETTINGS_KEY]: JSON.stringify(prefs),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushDebounce = useCallback(() => {
    if (debounceRef.current != null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => flushDebounce();
  }, [flushDebounce]);

  const updatePreferences = useCallback(
    (patch: Partial<ReaderPreferences>) => {
      setPreferences((prev) => {
        const next = { ...prev, ...patch };

        flushDebounce();
        debounceRef.current = setTimeout(() => {
          saveMutation.mutate(next);
        }, 500);

        return next;
      });
    },
    [saveMutation, flushDebounce],
  );

  return {
    preferences,
    updatePreferences,
    isLoading: settingsQuery.isLoading,
  };
}
