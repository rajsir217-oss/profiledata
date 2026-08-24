import React, { useMemo, useState } from 'react';
import SEO from './SEO';
import { SEO_BRAND_KIT } from '../config/seoBrandKit';
import './SEOBrandKitExport.css';

const escapeCsv = (value) => {
  const safeValue = String(value ?? '');
  if (safeValue.includes(',') || safeValue.includes('"') || safeValue.includes('\n')) {
    return `"${safeValue.replace(/"/g, '""')}"`;
  }
  return safeValue;
};

const flattenForCsv = (node, path = [], rows = []) => {
  if (Array.isArray(node)) {
    node.forEach((item, index) => {
      const itemPath = [...path, `${index + 1}`].join('.');
      if (item && typeof item === 'object') {
        flattenForCsv(item, [...path, `${index + 1}`], rows);
      } else {
        rows.push({ path: itemPath, type: 'array_item', value: item });
      }
    });
    return rows;
  }

  if (node && typeof node === 'object') {
    Object.entries(node).forEach(([key, value]) => {
      flattenForCsv(value, [...path, key], rows);
    });
    return rows;
  }

  rows.push({ path: path.join('.'), type: 'value', value: node });
  return rows;
};

const downloadTextFile = (filename, content, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const SEOBrandKitExport = () => {
  const [copyMessage, setCopyMessage] = useState('');

  const jsonContent = useMemo(() => JSON.stringify(SEO_BRAND_KIT, null, 2), []);

  const csvRows = useMemo(() => {
    return flattenForCsv(SEO_BRAND_KIT);
  }, []);

  const csvContent = useMemo(() => {
    const header = 'path,type,value';
    const lines = csvRows.map((row) => {
      return [escapeCsv(row.path), escapeCsv(row.type), escapeCsv(row.value)].join(',');
    });
    return [header, ...lines].join('\n');
  }, [csvRows]);

  const summary = useMemo(() => {
    const keywordGroups = SEO_BRAND_KIT.keywordUniverse || {};
    const groupArrays = Object.values(keywordGroups).filter(Array.isArray);
    const totalKeywords = groupArrays.reduce((count, list) => count + list.length, 0);
    const uniqueKeywords = new Set(groupArrays.flat()).size;

    return {
      keywordGroups: Object.keys(keywordGroups).length,
      totalKeywords,
      uniqueKeywords,
      taglines: SEO_BRAND_KIT.taglineOptions?.length || 0,
      metaDescriptions: SEO_BRAND_KIT.metaDescriptionOptions?.length || 0,
      shortAds: SEO_BRAND_KIT.adCopyVariants?.shortPerformance?.length || 0
    };
  }, []);

  const previewRows = csvRows.slice(0, 25);

  const handleCopyJson = async () => {
    if (!navigator?.clipboard?.writeText) {
      setCopyMessage('Clipboard access unavailable in this browser. Please download JSON instead.');
      return;
    }

    try {
      await navigator.clipboard.writeText(jsonContent);
      setCopyMessage('SEO brand kit JSON copied to clipboard.');
    } catch (_) {
      setCopyMessage('Copy failed. Please use the download options.');
    }
  };

  return (
    <>
      <SEO
        title="SEO Brand Kit Export | L3V3L Matches"
        description="Internal admin export for SEO brand kit keywords, taxonomy, and messaging assets."
        keywords="seo brand kit export, l3v3l matches admin"
        noindex={true}
        url="/admin-utilities?tab=seo-brand-kit"
      />

      <div className="seo-brand-kit-export">
        <div className="sbke-header">
          <h2>SEO Brand Kit Export</h2>
          <p>Download the complete keyword universe and brand taxonomy for SEO, paid ads, onboarding copy, and category tagging.</p>
        </div>

        <div className="sbke-actions" role="group" aria-label="SEO brand kit export actions">
          <button
            type="button"
            className="sbke-button sbke-button-primary"
            onClick={() => downloadTextFile('seo-brand-kit.json', jsonContent, 'application/json')}
          >
            Download JSON
          </button>
          <button
            type="button"
            className="sbke-button"
            onClick={() => downloadTextFile('seo-brand-kit.csv', csvContent, 'text/csv;charset=utf-8;')}
          >
            Download CSV
          </button>
          <button
            type="button"
            className="sbke-button"
            onClick={handleCopyJson}
          >
            Copy JSON
          </button>
        </div>

        {copyMessage && <p className="sbke-status">{copyMessage}</p>}

        <div className="sbke-summary-grid">
          <div className="sbke-summary-card">
            <span className="sbke-summary-label">Keyword Groups</span>
            <strong className="sbke-summary-value">{summary.keywordGroups}</strong>
          </div>
          <div className="sbke-summary-card">
            <span className="sbke-summary-label">Total Keywords</span>
            <strong className="sbke-summary-value">{summary.totalKeywords}</strong>
          </div>
          <div className="sbke-summary-card">
            <span className="sbke-summary-label">Unique Keywords</span>
            <strong className="sbke-summary-value">{summary.uniqueKeywords}</strong>
          </div>
          <div className="sbke-summary-card">
            <span className="sbke-summary-label">Taglines</span>
            <strong className="sbke-summary-value">{summary.taglines}</strong>
          </div>
          <div className="sbke-summary-card">
            <span className="sbke-summary-label">Meta Descriptions</span>
            <strong className="sbke-summary-value">{summary.metaDescriptions}</strong>
          </div>
          <div className="sbke-summary-card">
            <span className="sbke-summary-label">Short Ad Variants</span>
            <strong className="sbke-summary-value">{summary.shortAds}</strong>
          </div>
        </div>

        <section className="sbke-preview" aria-label="JSON preview">
          <h3>JSON Preview</h3>
          <pre className="sbke-json-preview">{jsonContent.slice(0, 2400)}{jsonContent.length > 2400 ? '\n\n...truncated' : ''}</pre>
        </section>

        <section className="sbke-preview" aria-label="CSV preview">
          <h3>CSV Preview (First 25 Rows)</h3>
          <div className="sbke-table-wrap">
            <table className="sbke-table">
              <thead>
                <tr>
                  <th>Path</th>
                  <th>Type</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={`${row.path}-${row.type}`}>
                    <td>{row.path}</td>
                    <td>{row.type}</td>
                    <td>{String(row.value ?? '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
};

export default SEOBrandKitExport;
