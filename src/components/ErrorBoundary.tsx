import * as React from "react";

type Props = {
  children: React.ReactNode;
  fallbackTitle?: string;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("UI crash:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 shadow-sm text-center space-y-3">
            <h2 className="text-[16px] font-bold text-foreground">
              {this.props.fallbackTitle ?? "Sahifada xatolik yuz berdi"}
            </h2>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Sahifa yiqilib qoldi. Sahifani yangilang yoki boshqa bo&apos;limga o&apos;ting.
              Agar takrorlansa, brauzer konsolidagi xatolikni yuboring.
            </p>
            <p className="text-[11px] text-red-600/90 break-words font-mono bg-red-50 rounded-xl px-3 py-2">
              {this.state.error.message || String(this.state.error)}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ error: null });
                window.location.reload();
              }}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-red-500 hover:bg-red-600"
            >
              Sahifani yangilash
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
