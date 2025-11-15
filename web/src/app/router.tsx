import { createBrowserRouter, createRoutesFromElements, Route } from 'react-router-dom';

import IndexPage from '@/pages/home/index';
import LoginPage from '@/pages/login/login';

const router = createBrowserRouter(createRoutesFromElements(<>
  <Route path="/" element={<IndexPage/>} />
  <Route path="/login" element={<LoginPage/>} />
</>));

export default router;
