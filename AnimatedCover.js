import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Easing } from 'react-native';

/**
 * AnimatedCover
 * Displays the current track's album art with a play-state-aware animation.
 *
 * Props:
 *  - coverUrl:  string   (album art URL, e.g. track.albumCover)
 *  - isPlaying: boolean  (from your player/context state)
 *  - size:      number   (px, default 280)
 *  - mode:      'spin' | 'pulse'  (default 'pulse')
 */
const AnimatedCover = ({ coverUrl, isPlaying, size = 280, mode = 'pulse' }) => {
  const rotation = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const rotateLoop = useRef(null);
  const pulseLoop = useRef(null);

  useEffect(() => {
    if (mode === 'spin') {
      if (isPlaying) {
        rotateLoop.current = Animated.loop(
          Animated.timing(rotation, {
            toValue: 1,
            duration: 8000, // one full rotation every 8s, like a slow vinyl spin
            easing: Easing.linear,
            useNativeDriver: true,
          })
        );
        rotateLoop.current.start();
      } else {
        rotateLoop.current?.stop();
      }
    }

    if (mode === 'pulse') {
      if (isPlaying) {
        pulseLoop.current = Animated.loop(
          Animated.sequence([
            Animated.timing(scale, {
              toValue: 1.04,
              duration: 900,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 1,
              duration: 900,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        );
        pulseLoop.current.start();
      } else {
        pulseLoop.current?.stop();
        Animated.timing(scale, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    }

    return () => {
      rotateLoop.current?.stop();
      pulseLoop.current?.stop();
    };
  }, [isPlaying, mode]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const radius = mode === 'spin' ? size / 2 : 16;
  const animatedStyle =
    mode === 'spin' ? { transform: [{ rotate: spin }] } : { transform: [{ scale }] };

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { width: size, height: size, borderRadius: radius },
        animatedStyle,
      ]}
    >
      <Image
        source={{ uri: coverUrl }}
        style={[styles.image, { width: size, height: size, borderRadius: radius }]}
        resizeMode="cover"
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  image: {
    backgroundColor: '#222',
  },
});

export default AnimatedCover;

/**
 * Example usage inside your Player screen:
 *
 * import AnimatedCover from './AnimatedCover';
 * ...
 * const { currentTrack, isPlaying } = usePlayer(); // your existing player context
 *
 * <AnimatedCover
 *   coverUrl={currentTrack?.albumCover}
 *   isPlaying={isPlaying}
 *   size={300}
 *   mode="pulse" // or "spin"
 * />
 */
