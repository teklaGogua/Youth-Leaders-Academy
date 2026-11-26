import { Route, Routes } from 'react-router-dom';
import HomePage from './HomePage';
import NotFoundPage from './NotFoundPage';
export default function App() { return <Routes><Route path="/" element={<HomePage />} /><Route path="*" element={<NotFoundPage />} /></Routes>; }
