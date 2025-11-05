import { createBrowserRouter, createRoutesFromElements, Route } from 'react-router-dom';

import IndexPage from '@/pages/home/index';
const router = createBrowserRouter(createRoutesFromElements(<>
  <Route path="/" element={<IndexPage/>}>
  </Route>
</>));

export default router;
