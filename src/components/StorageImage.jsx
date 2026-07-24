import { useState, useEffect } from "react";
import { ref, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";

const _cache = {};

export function StorageImage({ storagePath, directUrl, style, onClick, alt }) {
  const [src, setSrc] = useState(directUrl || _cache[storagePath] || null);

  useEffect(() => {
    if (src) return;
    if (!storagePath) return;
    if (_cache[storagePath]) { setSrc(_cache[storagePath]); return; }
    getDownloadURL(ref(storage, storagePath))
      .then(u => { _cache[storagePath] = u; setSrc(u); })
      .catch(() => { if (directUrl) setSrc(directUrl); });
  }, [storagePath, directUrl]);

  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt || ""}
      style={style}
      onClick={() => onClick?.(src)}
      onError={e => { e.currentTarget.parentElement.style.display = "none"; }}
    />
  );
}
