import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import 'antd/dist/reset.css';
import '@/styles/global.less';

import App from '@/app';

const container = document.getElementById('root');

if (!container) {
  throw new Error('找不到挂载节点 #root');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
