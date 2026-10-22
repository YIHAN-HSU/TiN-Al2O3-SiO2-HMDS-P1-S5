import {SessionBoundary} from './auth/client';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
// React delegates wheel events passively. Cancel page scrolling natively before
// the unchanged viewer zoom calculation receives the event.
document.addEventListener('wheel', e => {
  if (e.target instanceof HTMLCanvasElement) e.preventDefault();
}, {capture:true, passive:false});

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<SessionBoundary><App /></SessionBoundary>);
}
