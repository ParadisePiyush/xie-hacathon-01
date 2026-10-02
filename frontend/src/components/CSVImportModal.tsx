import React, { useState } from 'react';
import { Check, Download, FileUp, X } from 'lucide-react';
import { apiClient } from '../api/client';

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export const CSVImportModal: React.FC<CSVImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<{
    total_rows: number;
    imported_count: number;
    failed_count: number;
    errors: { row_number: number; error: string }[];
  } | null>(null);

  if (!isOpen) return null;

  const handleDownloadSample = () => {
    const sample =
      'latitude,longitude,waste_type,volume,description,address\n' +
      '19.9975,73.7898,hazardous,large,Hazardous battery dump,Old Market Gate 1\n' +
      '20.0100,73.8100,medical,medium,Medical clinic discard,East Street 4\n' +
      '19.9920,73.7850,general,overflow,Overflowing bin after festival,Central Plaza\n';

    const blob = new Blob([sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_pickup_requests.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setIsUploading(true);
      const res = await apiClient.importCSV(selectedFile);
      setResult(res);
      onImportComplete();
    } catch (err: any) {
      alert(`CSV Upload Failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '1.25rem' }}>Bulk CSV Request Import</h3>
            <p style={{ fontSize: '0.8rem', color: '#64748B' }}>
              Import hundreds of requests simultaneously with automatic prioritization.
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
              onClick={handleDownloadSample}
            >
              <Download size={14} /> Download Sample Template
            </button>
          </div>

          <div
            style={{
              border: '2px dashed #CBD5E1',
              borderRadius: '16px',
              padding: '2rem 1rem',
              textAlign: 'center',
              background: '#F8FAFC',
              cursor: 'pointer',
            }}
            onClick={() => document.getElementById('csv-file-input')?.click()}
          >
            <input
              id="csv-file-input"
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
              }}
            />
            <FileUp size={36} color="#4F46E5" style={{ margin: '0 auto 0.5rem auto' }} />
            <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>
              {selectedFile ? selectedFile.name : 'Click to choose a CSV file'}
            </p>
            <p style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Supports .csv files</p>
          </div>

          {result && (
            <div
              style={{
                background: result.failed_count === 0 ? '#ECFDF5' : '#FFF7ED',
                border: `1px solid ${result.failed_count === 0 ? '#A7F3D0' : '#FDBA74'}`,
                padding: '1rem',
                borderRadius: '12px',
              }}
            >
              <div style={{ fontWeight: 700, color: result.failed_count === 0 ? '#065F46' : '#9A3412' }}>
                Import complete: {result.imported_count} of {result.total_rows} successfully imported.
              </div>
              {result.failed_count > 0 && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#B91C1C' }}>
                  {result.failed_count} rows failed:
                  <ul style={{ paddingLeft: '1.2rem', marginTop: '0.25rem' }}>
                    {result.errors.slice(0, 3).map((e, idx) => (
                      <li key={idx}>Row {e.row_number}: {e.error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              className="btn-primary"
              style={{ flex: 1 }}
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
            >
              <Check size={18} /> {isUploading ? 'Importing...' : 'Upload & Process Requests'}
            </button>
            <button className="btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
