import { Component, type ReactNode } from "react";
interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen p-8">
          <div className="text-center space-y-4">
            <p className="text-4xl">😵</p>
            <h2 className="text-xl font-bold text-gray-700">Something went wrong</h2>
            <p className="text-sm text-gray-400">{this.state.error?.message}</p>
            <button onClick={() => this.setState({ hasError: false, error: null })}
              className="px-6 py-2 bg-indigo-500 text-white rounded-xl text-sm">Retry</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
