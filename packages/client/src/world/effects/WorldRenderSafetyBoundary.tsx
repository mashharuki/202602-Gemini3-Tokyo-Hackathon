import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  onFatalError: (reason: string) => void;
};

type State = {
  hasError: boolean;
};

export class WorldRenderSafetyBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    const reason = error instanceof Error ? error.message : "render_error";
    this.props.onFatalError(reason);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}
