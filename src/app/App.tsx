import '@fontsource-variable/noto-sans-georgian';
import '../styles/global.scss';
import { Route, Routes } from 'react-router-dom';
import PublicLayout from '../components/layout/PublicLayout';
import { AboutPage, CompetitionPage, FAQPage, TemporaryPage } from '../pages/PublicPages';
import HomePage from './HomePage';
import NotFoundPage from './NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/competition" element={<CompetitionPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/login" element={<TemporaryPage title="შესვლა" />} />
        <Route path="/register" element={<TemporaryPage title="ანგარიშის შექმნა" />} />
        <Route path="/apply" element={<TemporaryPage title="განაცხადის შევსება" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
