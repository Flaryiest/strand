import { createBrowserRouter, createRoutesFromElements, Route } from 'react-router-dom';

import IndexPage from '@/pages/home/index';
import LoginPage from '@/pages/login/login';
import SignupPage from '@/pages/signup/signup';

const router = createBrowserRouter(createRoutesFromElements(<>
  <Route path="/" element={<IndexPage/>} />
  <Route path="/login" element={<LoginPage/>} />
  <Route path="/signup" element={<SignupPage/>} />
</>));

export default router;
