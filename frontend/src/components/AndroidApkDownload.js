import React, { useState } from 'react';
import { getBackendUrl } from '../config/apiConfig';
import toastService from '../services/toastService';
import './AndroidApkDownload.css';

const AndroidApkDownload = () => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toastService.error('Please log in to download the APK.');
        return;
      }

      setDownloading(true);
      const endpointUrl = new URL(`${getBackendUrl()}/api/mobile/android/apk-url`);
      endpointUrl.searchParams.set('app', 'main');

      const res = await fetch(endpointUrl.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const detail = (await res.json().catch(() => null))?.detail;
        throw new Error(detail || 'Failed to get APK download link.');
      }

      const data = await res.json();
      const url = data?.url;
      if (!url) {
        throw new Error('Failed to get APK download link.');
      }

      window.location.assign(url);
    } catch (err) {
      toastService.error(err?.message || 'Failed to start APK download.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="android-apk-download-page">
      <div className="android-apk-download-card">
        <h2 className="android-apk-download-title">Android App</h2>
        <p className="android-apk-download-subtitle">Download the latest Android APK for manual installation.</p>

        <div className="android-apk-download-actions">
          <button
            type="button"
            className="btn-primary android-apk-download-btn"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? 'Preparing download...' : '⬇️ Download APK'}
          </button>
        </div>

        <div className="android-apk-download-notes">
          <div className="android-apk-download-note">
            <strong>Install tip:</strong> If Android blocks the install, enable “Install unknown apps” for your browser.
          </div>
          <div className="android-apk-download-note">
            <strong>Update tip:</strong> You can install the new APK over the old one (same package name).
          </div>
        </div>
      </div>
    </div>
  );
};

export default AndroidApkDownload;
