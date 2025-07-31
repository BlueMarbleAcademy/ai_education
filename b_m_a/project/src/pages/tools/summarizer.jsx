import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import {
  FileSearch,
  Upload,
  RefreshCw,
  Trash2,
  ClipboardCopy
} from 'lucide-react';
import { generateSummary } from '../../api/apiService';
import { msalInstance } from '../../authConfig';

const Summarizer = () => {
  const [file, setFile] = useState(null);
  const [summary, setSummary] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [summaryStyle, setSummaryStyle] = useState('high');
  const [summaryFormat, setSummaryFormat] = useState('bullet');
  const [copied, setCopied] = useState(false);

  const callGenerateSummary = async (input) => {
    if (input instanceof FormData) {
      input.append('style', summaryStyle);
      input.append('summary_format', summaryFormat);
      return await generateSummary(input);
    } else {
      return await generateSummary({ ...input, style: summaryStyle, summary_format: summaryFormat });
    }
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const lines = doc.splitTextToSize(summary, 180);
    doc.text(lines, 10, 10);
    doc.save('summary.pdf');
  };

  const handleDownloadDOCX = async () => {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [new Paragraph({ children: [new TextRun(summary)] })]
        }
      ]
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, 'summary.docx');
  };

  const handleSaveSummary = async () => {
    if (!summary) return;
    try {
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length === 0) return alert('You must be logged in.');

      const tokenResponse = await msalInstance.acquireTokenSilent({
        account: accounts[0],
        scopes: ['https://bluemarbleacademy.onmicrosoft.com/tasks-api/tasks.read']
      });

      const token = tokenResponse.accessToken;
      if (!token) return alert('You must be logged in.');

      const res = await fetch('http://localhost:8000/save-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ summary })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.detail || 'Save failed');
      alert('✅ Summary saved.');
    } catch (err) {
      console.error('Save error:', err);
      alert('❌ Could not save summary.');
    }
  };

  const onDrop = useCallback(
    async (acceptedFiles) => {
      setError('');
      const selectedFile = acceptedFiles[0];
      if (!selectedFile) return;
      setFile(selectedFile);
      setIsProcessing(true);

      if (selectedFile.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const text = e.target.result;
          if (!text || text.trim() === '') return setError('Empty text file');
          try {
            const data = await callGenerateSummary({ text });
            setSummary(data.summary);
          } catch (err) {
            console.error(err);
            setError('Summary failed.');
          } finally {
            setIsProcessing(false);
          }
        };
        reader.readAsText(selectedFile);
      } else {
        const formData = new FormData();
        formData.append('file', selectedFile);
        try {
          const data = await callGenerateSummary(formData);
          setSummary(data.summary);
        } catch (err) {
          console.error(err);
          setError('Summary failed.');
        } finally {
          setIsProcessing(false);
        }
      }
    },
    [summaryStyle, summaryFormat]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(summary).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleReset = () => {
    setFile(null);
    setSummary('');
    setError('');
  };

  return (
    <div className="relative bg-gradient-to-br from-[#edf2ff] to-[#fef9ff] min-h-screen py-12 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-purple-100 via-white to-transparent opacity-30 animate-pulse pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-3xl mx-auto bg-white rounded-3xl shadow-xl p-8 ring-1 ring-gray-200 backdrop-blur"
      >
        <div className="flex items-center gap-4 mb-8">
          <FileSearch className="h-8 w-8 text-indigo-600" />
          <h1 className="text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 animate-fade-in">
            Smart Summarizer
          </h1>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-semibold mb-1">Summary Style</label>
            <select
              value={summaryStyle}
              onChange={(e) => setSummaryStyle(e.target.value)}
              className="bg-gradient-to-r from-white to-gray-50 border border-gray-300 rounded-xl px-4 py-2 shadow-sm text-sm text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="high">High-Level</option>
              <option value="detailed">Detailed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Summary Format</label>
            <select
              value={summaryFormat}
              onChange={(e) => setSummaryFormat(e.target.value)}
              className="bg-gradient-to-r from-white to-gray-50 border border-gray-300 rounded-xl px-4 py-2 shadow-sm text-sm text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="bullet">Bullet Points</option>
              <option value="key">Key Sentences</option>
              <option value="qa">Q&A</option>
            </select>
          </div>
        </div>

        <motion.div
          {...getRootProps()}
          whileHover={{ scale: 1.02 }}
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 bg-white shadow-inner ${isDragActive ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:border-indigo-300'}`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-indigo-400 animate-bounce-slow" />
          <p className="text-sm text-gray-600 mt-2">
            {file ? `${file.name} (${(file.size / 1024).toFixed(1)} KB)` : 'Drop or click to upload a .txt, .pdf, or .docx file'}
          </p>
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl"
          >
            {error}
          </motion.div>
        )}

        <AnimatePresence>
          {(isProcessing || summary) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-10 relative bg-white p-6 rounded-2xl shadow-xl ring-1 ring-indigo-100 overflow-hidden"
            >
              <div className="absolute -inset-1 bg-gradient-to-br from-indigo-100 to-purple-100 opacity-10 rounded-2xl blur-lg animate-pulse pointer-events-none"></div>

              <div className="flex justify-between items-center mb-4 relative z-10">
                <h2 className="text-2xl font-semibold text-gray-800">Summary</h2>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={handleReset} className="text-gray-500 hover:text-gray-800 text-sm">
                    <Trash2 className="w-4 h-4" /> Clear
                  </button>

                  <button onClick={handleDownloadPDF} className="transition-all duration-200 transform hover:scale-105 hover:shadow-md bg-gradient-to-r from-purple-600 to-pink-500 text-white px-4 py-2 rounded-xl text-sm">
                    PDF
                  </button>

                  <button onClick={handleDownloadDOCX} className="transition-all duration-200 transform hover:scale-105 hover:shadow-md bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-4 py-2 rounded-xl text-sm">
                    DOCX
                  </button>

                  <button onClick={handleSaveSummary} className="transition-all duration-200 transform hover:scale-105 hover:shadow-md bg-gradient-to-r from-green-500 to-teal-600 text-white px-4 py-2 rounded-xl text-sm">
                    Save
                  </button>

                  <button onClick={handleCopy} className="transition-all duration-200 transform hover:scale-105 hover:shadow-md bg-gradient-to-r from-indigo-500 to-blue-600 text-white px-4 py-2 rounded-xl text-sm">
                    <ClipboardCopy className="inline-block w-4 h-4 mr-1" />
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="relative z-10 whitespace-pre-wrap text-gray-800 animate-fade-in-delay max-h-[400px] overflow-y-auto">
                {isProcessing ? (
                  <div className="flex items-center gap-2 text-indigo-500 animate-pulse">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generating summary...
                  </div>
                ) : (
                  summary
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default Summarizer;
