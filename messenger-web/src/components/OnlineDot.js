/**
 * OnlineDot — small presence indicator for user avatars.
 *
 * Designed to be absolutely positioned over the bottom-right corner of an
 * avatar (the parent should use `position: 'relative'`).
 *
 * Props:
 *   - online (bool): green when true, gray when false.
 *   - size  (number): diameter in px (default 12). Border scales with size.
 *   - style: optional override style.
 *
 * The dot is always rendered (not conditional on `online`) so the spacing
 * around the avatar stays stable when status flips.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

export default function OnlineDot({ online = false, size = 12, style }) {
  const ringWidth = Math.max(2, Math.round(size / 6));
  return (
    <View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ringWidth,
          backgroundColor: online ? '#22c55e' : '#6b7280',
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    borderColor: '#0f0f23', // matches sidebar/chat background to look "cut out"
  },
});
