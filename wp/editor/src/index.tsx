import { createRoot } from '@wordpress/element';
import { App } from './App';
import './editor.css';

const ROOT_ID = 'bestenberg-root';

const container = document.getElementById(ROOT_ID);

if (container) {
  container.removeAttribute('aria-busy');
  createRoot(container).render(<App />);
}
