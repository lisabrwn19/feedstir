import { Pressable, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { addMonths, buildMonthGrid, formatMonthLabel } from '@/utils/calendar';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * A single-month grid, Sunday-start. Purely presentational — the caller
 * decides which days are highlighted and what tapping one means, so this
 * doubles as both a read-only "browse the calendar" view and a date-range
 * picker depending on the props passed in.
 */
export function MonthCalendar({
  monthCursor,
  onMonthChange,
  isHighlighted,
  onDayPress,
}: {
  monthCursor: Date;
  onMonthChange: (next: Date) => void;
  isHighlighted: (iso: string) => boolean;
  onDayPress?: (iso: string) => void;
}) {
  const border = useThemeColor({}, 'icon');
  const accent = useThemeColor({}, 'accent');
  const days = buildMonthGrid(monthCursor);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => onMonthChange(addMonths(monthCursor, -1))} hitSlop={8}>
          <IconSymbol name="chevron.left" size={20} color={border} />
        </Pressable>
        <ThemedText type="defaultSemiBold">{formatMonthLabel(monthCursor)}</ThemedText>
        <Pressable onPress={() => onMonthChange(addMonths(monthCursor, 1))} hitSlop={8}>
          <IconSymbol name="chevron.right" size={20} color={border} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, i) => (
          <ThemedText key={i} style={[styles.weekdayText, { color: border }]}>
            {label}
          </ThemedText>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((day) => {
          const highlighted = day.inMonth && isHighlighted(day.iso);
          return (
            <Pressable
              key={day.iso}
              disabled={!day.inMonth || !onDayPress}
              onPress={() => onDayPress?.(day.iso)}
              style={styles.cell}>
              <View
                style={[
                  styles.cellInner,
                  highlighted && { backgroundColor: accent },
                ]}>
                <ThemedText
                  style={[
                    styles.cellText,
                    !day.inMonth && styles.cellTextOutOfMonth,
                    highlighted && styles.cellTextHighlighted,
                  ]}>
                  {day.date.getDate()}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellInner: {
    width: '78%',
    height: '78%',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: {
    fontSize: 14,
  },
  cellTextOutOfMonth: {
    opacity: 0.25,
  },
  cellTextHighlighted: {
    color: '#fff',
    fontWeight: '700',
  },
});
