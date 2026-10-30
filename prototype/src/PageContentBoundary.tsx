import { Component, type ReactNode } from "react";
import { Button, Card } from "./ui";

interface PageContentBoundaryProps {
  children: ReactNode;
  resetKey: string;
  title: string;
  reloadLabel: string;
  onReload: () => void;
}

/** Keep the shell available if one page fails, without remounting healthy work. */
export class PageContentBoundary extends Component<
  PageContentBoundaryProps,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(previous: PageContentBoundaryProps) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey)
      this.setState({ failed: false });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Card role="alert" aria-label={this.props.title} title={this.props.title}>
        <div className="actions">
          <Button onClick={this.props.onReload}>
            {this.props.reloadLabel}
          </Button>
        </div>
      </Card>
    );
  }
}
