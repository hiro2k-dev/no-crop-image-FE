import { Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Home from './pages/Home';
import NoCrop from './pages/NoCrop';
import Layout from './pages/Layout';

function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/nocrop" element={<NoCrop />} />
        <Route path="/layout" element={<Layout />} />
      </Routes>
    </>
  );
}

export default App;
