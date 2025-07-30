import React, { useState, useCallback } from 'react';
import { msalInstance } from "../../authConfig"; 
import { useDropzone } from 'react-dropzone';
import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";
import {
  FileText,
  Upload,
  RefreshCw,
  Download,
  Trash2,
  FileSearch
} from 'lucide-react';
import { generateSummary } from '../../api/apiService'; 

const Summarizer = () => {
  const [file, setFile] = useState(null);
  const [summary, setSummary] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [summaryStyle, setSummaryStyle] = useState('high');
  const [summaryFormat, setSummaryFormat] = useState('bullet');

  const callGenerateSummary = async (input) => {
    if (input instanceof FormData) {
      input.append('style', summaryStyle);
      input.append('summary_format', summaryFormat);
      return await generateSummary(input);
    } else {
      return await generateSummary({
        ...input,
        style: summaryStyle,
        summary_format: summaryFormat
      });
    }
  };

  const handleDownload = () => {
    const blob = new Blob([summary], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "summary.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const lines = doc.splitTextToSize(summary, 180); // wrap text
    doc.text(lines, 10, 10);
    doc.save("summary.pdf");
   };

  const handleDownloadDOCX = async () => {
    const doc = new Document({
       sections: [{
         properties: {},
         children: [
           new Paragraph({
             children: [new TextRun(summary)],
          }),
        ],
      }],
    });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, "summary.docx");
};

  const handleSaveSummary = async () => {
    if (!summary) return;

    try {
     const accounts = msalInstance.getAllAccounts();
     if (accounts.length === 0) {
       alert("You must be logged in to save summaries.");
        return;
     }

     const tokenResponse = await msalInstance.acquireTokenSilent({
      account: accounts[0],
      scopes: ["https://bluemarbleacademy.onmicrosoft.com/tasks-api/tasks.read"], 
     });

     const token = tokenResponse.accessToken;

      if (!token) {
        alert("You must be logged in to save summaries.");
        return;
      }

      const apiResponse = await fetch("http://localhost:8000/save-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ summary })
      });

      const result = await apiResponse.json();
      if (!apiResponse.ok) throw new Error(result.detail || "Failed to save summary");

      alert("✅ Summary saved successfully!");
    } catch (err) {
      console.error("Error saving summary:", err);
      alert("❌ Failed to save summary. See console for details.");
    }
  };
  



  const onDrop = useCallback(async (acceptedFiles) => {
    setError('');
    const selectedFile = acceptedFiles[0];

    if (selectedFile) {
      setFile(selectedFile);
      setIsProcessing(true);

      if (selectedFile.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const text = e.target.result;
          if (!text || text.trim() === "") {
            setError("The text file appears to be empty.");
            setIsProcessing(false);
            return;
          }
          try {
            const data = await callGenerateSummary({ text });
            setSummary(data.summary);
          } catch (err) {
            console.error("Error generating summary:", err);
            setError(err.message || 'Failed to generate summary. Please try again.');
          } finally {
            setIsProcessing(false);
          }
        };
        reader.onerror = (e) => {
          console.error("Error reading file:", e);
          setError("Error reading the file. Please try again.");
          setIsProcessing(false);
        };
        reader.readAsText(selectedFile);
      } else if (
        selectedFile.type === 'application/pdf' ||
        selectedFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        try {
          const data = await callGenerateSummary(formData);
          setSummary(data.summary);
        } catch (err) {
          console.error("Error generating summary:", err);
          setError(err.message || 'Failed to generate summary. Please try again.');
        } finally {
          setIsProcessing(false);
        }
      } else {
        setError('Please upload a valid .txt, .pdf, or .docx file');
        setIsProcessing(false);
      }
    }
  }, [summaryStyle, summaryFormat]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1
  });

  const handleReset = () => {
    setFile(null);
    setSummary('');
    setError('');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="bg-blue-100 p-3 rounded-full">
          <FileSearch className="h-8 w-8 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Text Summarizer</h1>
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-8 border-b border-gray-100">
          {/* Summary Style */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Summary Style</label>
            <div className="flex gap-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  value="high"
                  checked={summaryStyle === 'high'}
                  onChange={() => setSummaryStyle('high')}
                  className="form-radio text-blue-600"
                />
                <span className="ml-2 text-gray-700">High-level</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  value="detailed"
                  checked={summaryStyle === 'detailed'}
                  onChange={() => setSummaryStyle('detailed')}
                  className="form-radio text-blue-600"
                />
                <span className="ml-2 text-gray-700">Detailed</span>
              </label>
            </div>
          </div>

          {/* Summary Format */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Summary Format</label>
            <div className="flex gap-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  value="bullet"
                  checked={summaryFormat === 'bullet'}
                  onChange={() => setSummaryFormat('bullet')}
                  className="form-radio text-blue-600"
                />
                <span className="ml-2 text-gray-700">Bullet List</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  value="key"
                  checked={summaryFormat === 'key'}
                  onChange={() => setSummaryFormat('key')}
                  className="form-radio text-blue-600"
                />
                <span className="ml-2 text-gray-700">Key Sentences</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  value="qa"
                  checked={summaryFormat === 'qa'}
                  onChange={() => setSummaryFormat('qa')}
                  className="form-radio text-blue-600"
                />
                <span className="ml-2 text-gray-700">Q&A</span>
              </label>
            </div>
          </div>

          {/* File Upload */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors duration-200 ${
              isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
            } ${file ? 'bg-gray-50' : ''}`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-3">
              <Upload className={`h-10 w-10 ${isDragActive ? 'text-blue-600' : 'text-gray-400'}`} />
              {file ? (
                <>
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-medium text-gray-900">
                    Drop your file here, or click to select
                  </p>
                  <p className="text-sm text-gray-500">
                    Supported formats: .txt, .pdf, .docx
                  </p>
                </>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Summary Output */}
        {(isProcessing || summary) && (
          <div className="p-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Summary</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors duration-200"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear
                </button>

                {summary && (
                  <>
                    <button
                      onClick={handleDownloadPDF}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200"
                    >
                      📄 Save as PDF
                    </button>

                    <button
                      onClick={handleDownloadDOCX}
                      className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors duration-200"
                    >
                      📝 Save as DOCX
                    </button>

                    <button
                      onClick={handleSaveSummary}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                    >
                      💾 Save Summary
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-6">
              {isProcessing ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 text-blue-600 animate-spin" />
                  <span className="ml-3 text-gray-600">Generating summary...</span>
                </div>
              ) : (
                <div className="prose max-w-none">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {summary}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Summarizer;
