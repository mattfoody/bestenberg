import { useEffect, useRef, useState } from '@wordpress/element';
import { markOnboarded, settings } from '../api';
import { useStore, type Mode } from '../store';

const INTRO: Record<Mode, { title: string; points: string[]; action: string }> = {
  client: {
    title: 'Editing your site',
    points: [
      'Click any text on the page and type to change it.',
      'Click an image or a button, then change it in the panel on the right.',
      'Nothing changes on your site until you choose Save. Undo takes back a step.',
    ],
    action: 'Start editing',
  },
  design: {
    title: 'Welcome to Bestenberg',
    points: [
      'Build with Add: ready-made sections, single components, or live site data. Generate drafts a page from a description or a screenshot.',
      'Select anything to style it with the site’s colours, sizes and spacing. Preview phone and tablet in the bar above.',
      'Header, footer and templates are in the page list. Client view shows what people who only edit content can change.',
    ],
    action: 'Start designing',
  },
};

/** One-time introduction, shown the first time a person uses a mode. */
export function Welcome() {
  const { state } = useStore();
  const [seen, setSeen] = useState<readonly string[]>(() => settings().onboarded ?? []);
  const dialog = useRef<HTMLDialogElement>(null);
  const open = !seen.includes(state.mode);

  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [open]);

  if (!open) return null;
  const intro = INTRO[state.mode];
  const close = () => {
    setSeen([...seen, state.mode]);
    // Best effort: if this fails the introduction simply shows again next time.
    markOnboarded(state.mode).catch(() => undefined);
  };

  return (
    <dialog
      ref={dialog}
      className="bbe-dialog bbe-welcome-dialog"
      aria-labelledby="bbe-welcome-title"
      onClose={close}
    >
      <h2 id="bbe-welcome-title">{intro.title}</h2>
      <ul>
        {intro.points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <form method="dialog" className="bbe-dialog__actions">
        <button type="submit" className="bbe-button bbe-button--primary" autoFocus>
          {intro.action}
        </button>
      </form>
    </dialog>
  );
}
