import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.root}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.error.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#000' },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  message: { color: '#bbb', textAlign: 'center' },
});
