// frontend/src/components/ImageCarousel.js
import React, { useState } from 'react';

const ImageCarousel = ({ images }) => {
  const [index, setIndex] = useState(0);

  if (!images || images.length === 0) return null;

  const prev = () => {
    setIndex((index - 1 + images.length) % images.length);
  };

  const next = () => {
    setIndex((index + 1) % images.length);
  };

  const backendUrl = process.env.REACT_APP_API_URL?.replace('/api/users', '') || 'http://localhost:5001';
  
  return (
    <div className="text-center my-3">
      <img
        src={images[index].includes('http') ? images[index] : `${backendUrl}/${images[index]}`}
        alt={`img-${index}`}
        className="img-thumbnail"
        width="300"
        height="300"
      />
      <div className="mt-2">
        <button className="btn btn-outline-secondary me-2" onClick={prev}>◀️</button>
        <button className="btn btn-outline-secondary" onClick={next}>▶️</button>
      </div>
    </div>
  );
};

export default ImageCarousel;
