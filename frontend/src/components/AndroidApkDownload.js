import React, { useState } from 'react';
import { getBackendUrl } from '../config/apiConfig';
import toastService from '../services/toastService';
import './AndroidApkDownload.css';

const AndroidApkDownload = () => {
  const [downloadingMain, setDownloadingMain] = useState(false);
  const [downloadingMsgr, setDownloadingMsgr] = useState(false);

  const handleDownload = async (appType) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toastService.error('Please log in to download the APK.');
        return;
      }

      const setDownloading = appType === 'main' ? setDownloadingMain : setDownloadingMsgr;
      setDownloading(true);
      const endpointUrl = new URL(`${getBackendUrl()}/api/mobile/android/apk-url`);
      endpointUrl.searchParams.set('app', appType);

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
      const setDownloading = appType === 'main' ? setDownloadingMain : setDownloadingMsgr;
      setDownloading(false);
    }
  };

  return (
    <div className="android-apk-download-page">
      <div className="android-apk-download-card">
        <h2 className="android-apk-download-title">Android Apps</h2>
        <p className="android-apk-download-subtitle">Download the latest Android APKs for manual installation.</p>

        <div className="android-apk-download-actions">
          <button
            type="button"
            className="btn-primary android-apk-download-btn"
            onClick={() => handleDownload('main')}
            disabled={downloadingMain}
          >
            {downloadingMain ? 'Preparing download...' : '⬇️ Download L3V3L Matches'}
          </button>
          <button
            type="button"
            className="btn-primary android-apk-download-btn android-apk-download-btn-msgr"
            onClick={() => handleDownload('msgr')}
            disabled={downloadingMsgr}
          >
            {downloadingMsgr ? 'Preparing download...' : '⬇️ Download L3V3L Matches Messenger'}
          </button>
        </div>

        <div className="android-apk-download-notes">
          <div className="android-apk-download-note">
            <strong>Install tip:</strong> If Android blocks the install, enable "Install unknown apps" for your browser.
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
