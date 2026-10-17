import { useEffect, type ReactNode } from "react";
import { Card, Typography } from "antd";
import { Wordmark } from "./Wordmark";
import { FONT_SIZE } from "../constants/typography";

interface AuthStageProps {
  /** The card's own heading, naming what the page is for ("Sign In"). */
  title: ReactNode;
  children: ReactNode;
}

/** The account pages' stage: a projector beam onto the card, with the wordmark
 *  as the page's main heading. Colors and the beam live in App.css (`.auth-stage`). */
export function AuthStage({ title, children }: AuthStageProps) {
  useKeyboardResizesPage();
  return (
    <div className="auth-stage">
      <div className="auth-stage-beam" aria-hidden="true" />
      <header className="auth-stage-head">
        {/* Sized in App.css: it scales with the screen height. */}
        <Wordmark />
        <Typography.Text type="secondary" className="auth-tagline">
          Track what you've watched and find what to watch next.
        </Typography.Text>
      </header>
      <Card className="auth-screen" style={{ width: "100%", maxWidth: 360 }}>
        <Typography.Title level={2} style={{ fontSize: FONT_SIZE.emphasis, marginTop: 0, marginBottom: 16 }}>
          {title}
        </Typography.Title>
        {children}
      </Card>
    </div>
  );
}

/** While an account page is open, a phone keyboard shrinks the page instead
 *  of covering it (Android Chrome and Firefox; Safari ignores it), so the
 *  stage's height rules fit the form above the keyboard. Scoped to these
 *  pages: elsewhere the fixed bottom nav would ride up on the keyboard. */
function useKeyboardResizesPage() {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!meta) return;
    const original = meta.content;
    if (!/interactive-widget/.test(original)) {
      meta.content = `${original}, interactive-widget=resizes-content`;
    }
    return () => {
      meta.content = original;
    };
  }, []);
}
