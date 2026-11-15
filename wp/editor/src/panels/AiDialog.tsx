import { useEffect, useRef, useState } from '@wordpress/element';
import { generateSections, MAX_REPAIR_ROUNDS, type ModelImage } from '@bestenberg/ai';
import { findNode } from '@bestenberg/schema';
import { aiStatus, readScreenshot, siteProvider, type AiStatus } from '../ai';
import { errorMessage } from '../api';
import { currentDoc, useStore } from '../store';

type Placement = 'add' | 'replace';

interface Props {
  onClose: () => void;
}

export function AiDialog({ onClose }: Props) {
  const { state, dispatch } = useStore();
  const doc = currentDoc(state);
  const dialog = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [request, setRequest] = useState('');
  const [placement, setPlacement] = useState<Placement>('add');
  const [image, setImage] = useState<{ name: string; data: ModelImage } | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    dialog.current?.showModal();
    aiStatus()
      .then(setStatus)
      .catch(() => setStatus({ available: false, connectorsUrl: '' }));
  }, []);

  const busy = progress !== null;
  const empty = !doc || doc.root.length === 0;
  const canSubmit =
    !busy && status?.available === true && (request.trim() !== '' || image !== null);

  const chooseImage = async (file: File | undefined) => {
    setProblem(null);
    if (!file) {
      setImage(null);
      return;
    }
    try {
      setImage({ name: file.name, data: await readScreenshot(file) });
    } catch {
      setImage(null);
      setProblem('That file could not be read as an image. Use a PNG, JPEG or WebP screenshot.');
    }
  };

  const submit = async () => {
    if (!doc || !canSubmit) return;
    setProblem(null);
    setProgress('Writing…');
    try {
      const result = await generateSections({
        request: request.trim() === '' ? 'Rebuild the page in the screenshot.' : request,
        provider: siteProvider,
        images: image ? [image.data] : undefined,
        existing: placement === 'add' ? doc.root : undefined,
        onRound: (round, issues) => {
          if (round > 0) {
            setProgress(
              `Fixing ${issues.length} ${issues.length === 1 ? 'problem' : 'problems'} (attempt ${round + 1} of ${MAX_REPAIR_ROUNDS + 1})…`,
            );
          }
        },
      });
      if (!result.ok) {
        setProgress(null);
        setProblem(
          `The AI did not produce a valid result after ${result.calls} attempts, so nothing was added. Try again, or make the request shorter and more specific.`,
        );
        return;
      }
      const selected = state.selectedId ? findNode(doc.root, state.selectedId) : null;
      const topId = selected ? (selected.ancestors[0] ?? selected.node.id) : null;
      const after = topId ? doc.root.findIndex((node) => node.id === topId) : -1;
      const index = after === -1 ? doc.root.length : after + 1;
      const root =
        placement === 'replace'
          ? result.nodes
          : [...doc.root.slice(0, index), ...result.nodes, ...doc.root.slice(index)];
      dispatch({
        type: 'commit',
        doc: { ...doc, root },
        select: result.nodes[0]?.id ?? null,
        review: { sections: result.nodes.length },
      });
      onClose();
    } catch (error) {
      setProgress(null);
      setProblem(errorMessage(error));
    }
  };

  return (
    <dialog
      ref={dialog}
      className="bbe-dialog"
      aria-labelledby="bbe-ai-title"
      onCancel={(event) => {
        // Escape closes the dialog unless a request is running.
        if (busy) event.preventDefault();
      }}
      onClose={onClose}
    >
      <form
        method="dialog"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <h2 id="bbe-ai-title">Generate with AI</h2>

        {status && !status.available && (
          <p className="bbe-dialog__problem" role="alert">
            No AI provider is connected to this site yet.{' '}
            {status.connectorsUrl !== '' ? (
              <a href={status.connectorsUrl} target="_blank" rel="noreferrer">
                Connect one under Settings → Connectors
              </a>
            ) : (
              'Ask an administrator to connect one under Settings → Connectors.'
            )}
          </p>
        )}

        <label className="bbe-dialog__label" htmlFor="bbe-ai-request">
          What should it make?
        </label>
        <textarea
          id="bbe-ai-request"
          rows={5}
          value={request}
          disabled={busy}
          placeholder="A landing page for a neighbourhood bakery: hero, three reasons to visit, opening hours, and a call to order online."
          onChange={(event) => setRequest(event.target.value)}
        />

        <label className="bbe-dialog__label" htmlFor="bbe-ai-image">
          Screenshot to rebuild (optional)
        </label>
        <input
          id="bbe-ai-image"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={(event) => void chooseImage(event.target.files?.[0])}
        />
        {image && <p className="bbe-dialog__hint">{image.name} will be sent to the AI provider.</p>}

        {!empty && (
          <fieldset className="bbe-dialog__choice" disabled={busy}>
            <legend>Where should it go?</legend>
            <label>
              <input
                type="radio"
                name="bbe-ai-placement"
                checked={placement === 'add'}
                onChange={() => setPlacement('add')}
              />
              Add to this page
            </label>
            <label>
              <input
                type="radio"
                name="bbe-ai-placement"
                checked={placement === 'replace'}
                onChange={() => setPlacement('replace')}
              />
              Replace everything on this page
            </label>
          </fieldset>
        )}

        {problem && (
          <p className="bbe-dialog__problem" role="alert">
            {problem}
          </p>
        )}
        {progress && (
          <p className="bbe-dialog__progress" role="status">
            {progress}
          </p>
        )}

        <div className="bbe-dialog__actions">
          <button
            type="button"
            className="bbe-button bbe-button--quiet"
            disabled={busy}
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </button>
          <button type="submit" className="bbe-button bbe-button--primary" disabled={!canSubmit}>
            Generate
          </button>
        </div>
      </form>
    </dialog>
  );
}
