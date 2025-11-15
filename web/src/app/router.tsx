import { createBrowserRouter, createRoutesFromElements, Route } from 'react-router-dom';

import IndexPage from '@/pages/home/index';
import LoginPage from '@/pages/login/login';
import SignupPage from '@/pages/signup/signup';
import ChatPage from '@/pages/chat/chat';
import GoogleCallback from '@/pages/auth/GoogleCallback';

const router = createBrowserRouter(createRoutesFromElements(<>
  <Route path="/" element={<IndexPage/>} />
  <Route path="/login" element={<LoginPage/>} />
  <Route path="/signup" element={<SignupPage/>} />
  <Route path="/chat" element={<ChatPage/>} />
  <Route path="/auth/google/callback" element={<GoogleCallback/>} />
</>));

export default router;
