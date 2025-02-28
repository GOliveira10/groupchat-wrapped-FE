import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { Camera, Copy } from 'lucide-react';


import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const analysisApiUrl = 'https://groupchat-wrapped-analysis.fly.dev';


// ScrollIndicator component
const ScrollIndicator = ({ showIndicator }) => {
  if (!showIndicator) return null;
  
  return (
    <div className="fixed right-12 top-1/2 -translate-y-1/2 flex flex-col items-center animate-fade-in">
      <div className="animate-bounce flex flex-col items-center">
        <svg 
          width="24" 
          height="24" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="text-blue-500"
        >
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <polyline points="19 12 12 19 5 12"></polyline>
        </svg>
        <p className="text-sm font-medium text-gray-500 mt-2">Scroll Down</p>
      </div>
    </div>
  );
};

// Whataspp connector
const WhatsAppConnector = ({ onChatSelected }) => {
  const [sessionId, setSessionId] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  const initializeConnection = async () => {
    console.log('Initializing WhatsApp connection...');
    try {
      setStatus('connecting');
      const response = await fetch('http://localhost:3001/connect-whatsapp', {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to connect to WhatsApp');
      
      const data = await response.json();
      console.log('WhatsApp connect response:', data);
      
      if (data.qrCode && data.sessionId) {
        setQrCode(data.qrCode);
        setSessionId(data.sessionId);
        setStatus('awaiting_scan');
      } else {
        throw new Error('No QR code or sessionId returned');
      }
    } catch (error) {
      console.error('WhatsApp connect error:', error);
      setError(error.message);
      setStatus('error');
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {qrCode ? (
        <div className="text-center">
          <img 
            src={`data:image/png;base64,${qrCode}`} 
            alt="WhatsApp QR Code"
            className="mx-auto mb-4"
          />
          <p className="text-sm text-gray-600">
            Scan this QR code with WhatsApp
          </p>
        </div>
      ) : (
        <button
          onClick={initializeConnection}
          disabled={status === 'connecting'}
          className="w-full px-4 py-3 bg-green-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-700 transition-colors"
        >
          {status === 'connecting' ? 'Connecting...' : 'Connect to WhatsApp'}
        </button>
      )}
    </div>
  );
};


// Helper functions
const isValidArray = (arr) => Array.isArray(arr) && arr.length > 0;

const safeGet = (obj, path, defaultValue = '') => {
  try {
    return path.split('.').reduce((acc, part) => acc?.[part], obj) ?? defaultValue;
  } catch {
    return defaultValue;
  }
};
const sortBarData = (labels, data) => {
  if (!isValidArray(labels) || !isValidArray(data) || labels.length !== data.length) {
    return { sortedLabels: labels || [], sortedData: data || [] };
  }
  const pairs = labels.map((label, i) => [label, data[i]]);
  pairs.sort((a, b) => b[1] - a[1]);
  return {
    sortedLabels: pairs.map(pair => pair[0]),
    sortedData: pairs.map(pair => pair[1])
  };
};
const getRandomColor = () => {
  const r = Math.floor(Math.random() * 255);
  const g = Math.floor(Math.random() * 255);
  const b = Math.floor(Math.random() * 255);
  return `rgba(${r}, ${g}, ${b}, 0.6)`;
};
const generateDistinctColors = (count) => {
  const hueStep = 360 / count;
  return Array.from({ length: count }, (_, i) => {
    const hue = i * hueStep;
    return `hsla(${hue}, 70%, 60%, 0.6)`;
  });
};

const wrapText = (ctx, text, x, y, maxWidth, lineHeight) => {
  console.log('Wrapping text:', text); // Debug the input text
  const words = text.split(' ');
  let line = '';
  const lines = [];

  // Break text into multiple lines
  for (const word of words) {
    const testLine = line + word + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;

    if (testWidth > maxWidth && line !== '') {
      console.log('Line exceeds maxWidth:', line); // Debug each wrapped line
      lines.push(line.trim());
      line = word + ' ';
    } else {
      line = testLine;
    }
  }
  lines.push(line.trim()); // Add the last line
  console.log('Final wrapped lines:', lines); // Debug the final lines array

  // Draw each line of text
  lines.forEach((line, index) => {
    console.log('Drawing line:', line, 'at y:', y + index * lineHeight); // Debug the position of each line
    ctx.fillText(line, x, y + index * lineHeight);
  });
};



const groupBySender = (data, dateField='date', valueField='message_count') => {
  if (!isValidArray(data)) return { dates: [], datasets: [] };
  
  try {
    const senders = [...new Set(data.map(d => safeGet(d, 'sender')))].filter(Boolean);
    const dates = [...new Set(data.map(d => safeGet(d, dateField)))].filter(Boolean).sort();
    const colors = generateDistinctColors(senders.length);

    const datasets = senders.map((sender, index) => {
      const senderData = data.filter(d => safeGet(d, 'sender') === sender);
      const values = dates.map(dt => {
        const entry = senderData.find(x => safeGet(x, dateField) === dt);
        return safeGet(entry, valueField, 0);
      });
      
      const color = colors[index];
      
      return {
        label: sender,
        data: values,
        borderColor: color,
        backgroundColor: color,
        fill: true
      };
    });

    return { dates, datasets };
  } catch (error) {
    console.error('Error in groupBySender:', error);
    return { dates: [], datasets: [] };
  }
};

const downloadCanvas = (canvas, filename) => {
  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
};


const handleExport = async (elementId, type) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  try {
    // Wait for fonts to load
    await document.fonts.ready;
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check if this is a chart (has canvas element)
    const isChart = element.querySelector('canvas') !== null;

    if (isChart) {
      const chartCanvas = element.querySelector('canvas');
      const containerWidth = element.offsetWidth;
      const containerHeight = element.offsetHeight;

      // Create a new canvas with scaled dimensions
      const exportCanvas = document.createElement('canvas');
      const resolutionScale = 1; // Scale factor for 2x resolution
      const padding = 40 * resolutionScale;

      exportCanvas.width = (containerWidth * resolutionScale) + 2 * padding;
      exportCanvas.height = (containerHeight * resolutionScale) + 2 * padding;

      const ctx = exportCanvas.getContext('2d');
      ctx.scale(resolutionScale, resolutionScale); // Scale the canvas

      // Fill background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

      // Calculate scaling to maintain aspect ratio
      const scale = Math.min(
        (exportCanvas.width / resolutionScale - padding * 2) / chartCanvas.width,
        (exportCanvas.height / resolutionScale - padding * 2) / chartCanvas.height
      );

      // Draw the chart canvas centered and scaled
      const x = (exportCanvas.width / resolutionScale - chartCanvas.width * scale) / 2;
      const y = padding / resolutionScale + 50; // Offset slightly below the title

      ctx.drawImage(
        chartCanvas,
        x,
        y,
        chartCanvas.width * scale,
        chartCanvas.height * scale
      );

      // Get computed styles from elements
      const titleElement = element.querySelector('h2');
      const commentaryElement = element.querySelector('p');

      let contentOffsetY = 50; // Initial offset for title positioning

      if (titleElement) {
        const titleStyle = window.getComputedStyle(titleElement);
        ctx.font = `${titleStyle.fontWeight} ${parseInt(titleStyle.fontSize) * resolutionScale}px ${titleStyle.fontFamily}`;
        ctx.fillStyle = titleStyle.color;
        ctx.textAlign = 'center';

        ctx.fillText(
          titleElement.textContent,
          exportCanvas.width / (2 * resolutionScale),
          contentOffsetY
        );
        contentOffsetY += 500; // Move down after title for next elements
      }

      if (commentaryElement) {
        const commentaryStyle = window.getComputedStyle(commentaryElement);
        ctx.font = `${commentaryStyle.fontWeight} ${parseInt(commentaryStyle.fontSize) * resolutionScale}px ${commentaryStyle.fontFamily}`;
        ctx.fillStyle = commentaryStyle.color;
        ctx.textAlign = 'center';

        const maxWidth = (exportCanvas.width - padding * 2) / resolutionScale; // Adjust padding
        const lineHeight = parseInt(commentaryStyle.fontSize) * 1.5; // Line height

        wrapText(ctx, commentaryElement.textContent, exportCanvas.width / (2 * resolutionScale), contentOffsetY, maxWidth, lineHeight);
      }

      // Draw watermark
      const watermarkStyle = window.getComputedStyle(element.querySelector('.text-gray-400') || document.body);
      ctx.font = `${parseInt(watermarkStyle.fontSize || '14') * resolutionScale}px ${watermarkStyle.fontFamily || 'Inter'}`;
      ctx.fillStyle = '#9CA3AF'; // text-gray-400
      ctx.textAlign = 'right';
      ctx.fillText(
        'Get your Groupchat Wrapped @ wrapped.chat',
        exportCanvas.width / resolutionScale - 20,
        exportCanvas.height / resolutionScale - 20
      );

      if (type === 'clipboard') {
        exportCanvas.toBlob(async (blob) => {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            alert('Copied to clipboard!');
          } catch (err) {
            console.error('Failed to copy to clipboard:', err);
            downloadCanvas(exportCanvas, elementId);
          }
        });
      } else {
        downloadCanvas(exportCanvas, elementId);
      }
    } else {
      // Enhanced html2canvas capture for text summaries
      const canvas = await html2canvas(element, {
        backgroundColor: 'white',
        scale: 1, // Double resolution
        logging: true,
        width: element.offsetWidth * 1 + 80,
        height: element.offsetHeight * 1 + 80,
        windowWidth: element.offsetWidth * 1 + 80,
        windowHeight: element.offsetHeight * 1 + 80,
        x: 0,
        y: 0,
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.getElementById(elementId);
          if (!clonedElement) return;

          // Apply styles explicitly to all elements to ensure consistency
          clonedElement.style.backgroundColor = 'white';
          clonedElement.style.padding = '5px';
          clonedElement.style.display = 'flex';
          clonedElement.style.flexDirection = 'column';
          clonedElement.style.alignItems = 'center';

          // Ensure each summary card retains box shadow, padding, and styling
          const summaryCards = clonedElement.querySelectorAll('.rounded-lg');
          summaryCards.forEach(card => {
            card.style.backgroundColor = 'white';
            //card.style.boxShadow = '0 1px 1px rgba(0, 0, 0, 0.1), 0 1px 1px rgba(0, 0, 0, 0.06)';
            card.style.padding = '4px';
            card.style.borderRadius = '0.75rem';
            card.style.margin = '10px';
          });

          // Explicitly set fonts, spacing, and alignment
          const allText = clonedElement.querySelectorAll('h2, p, span');
          allText.forEach(el => {
            const originalStyle = window.getComputedStyle(el);
            el.style.fontFamily = originalStyle.fontFamily;
            el.style.fontSize = originalStyle.fontSize;
            el.style.color = originalStyle.color;
            el.style.lineHeight = originalStyle.lineHeight;
            el.style.textAlign = 'center';
          });
        }
      });

      if (type === 'clipboard') {
        canvas.toBlob(async (blob) => {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            alert('Copied to clipboard!');
          } catch (err) {
            console.error('Failed to copy to clipboard:', err);
            downloadCanvas(canvas, elementId);
          }
        });
      } else {
        downloadCanvas(canvas, elementId);
      }
    }
  } catch (err) {
    console.error('Export failed:', err);
  }
};





// FE components

const TextSummaryCard = ({ title, summary, isVisible }) => {
  if (!summary) return null;
  
  return (
    <div className={`transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'}`}>
      <div className="bg-white/50 backdrop-blur-sm shadow-xl w-full max-w-4xl mx-auto rounded-xl">
        <div className="p-8">
          <h2 className="text-2xl font-bold mb-6 text-center">{title}</h2>
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">
              {summary}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const AnimatedChart = ({ chart, isVisible, index }) => {
  const chartRef = useRef(null);

  useEffect(() => {
    return () => {
      if (chartRef.current && chartRef.current.chartInstance) {
        chartRef.current.chartInstance.destroy();
      }
    };
  }, []);

  if (!chart || !chart.data) return null;

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      x: {
        type: 'category',
        display: true,
      },
      y: {
        type: 'linear',
        display: true,
      }
    },
    plugins: {
      legend: {
        position: 'top',
        labels: { font: { family: 'Inter' } }
      }
    },
    animation: {
      duration: 1000,
      easing: 'easeInOutQuart'
    }
  };

  return (
    <div className={`transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'}`}>
      <div className="bg-white/50 backdrop-blur-sm shadow-xl w-full max-w-4xl mx-auto rounded-xl">
        <div className="relative p-8">
          <div id={`chart-${index}`}>
            <h2 className="text-2xl font-bold mb-6 text-center">{chart.title}</h2>
            <div className="w-full aspect-[16/9]">
              {chart.type === "Bar" ? (
                <Bar 
                  ref={chartRef}
                  data={chart.data}
                  options={options}
                />
              ) : chart.type === "Line" ? (
                <Line 
                  ref={chartRef}
                  data={chart.data}
                  options={options}
                />
              ) : (
                <div>Unsupported chart type</div>
              )}
            </div>
            <p className="mt-1 text-gray-600 text-center">{chart.commentary}</p>
            <div className="text-right mt-6">
              <span className="text-gray-400 text-sm">Get your Groupchat Wrapped @ wrapped.chat</span>
            </div>
          </div>
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              onClick={() => handleExport(`chart-${index}`, 'clipboard')}
              className="p-2 rounded-full bg-white/80 hover:bg-white transition-colors shadow-sm"
              title="Copy to clipboard"
            >
              <Copy className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={() => handleExport(`chart-${index}`, 'download')}
              className="p-2 rounded-full bg-white/80 hover:bg-white transition-colors shadow-sm"
              title="Download as PNG"
            >
              <Camera className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const DayChatLogsDrawer = ({ isOpen, logs, onClose }) => {
  return (
    <div
      className={`fixed top-0 right-0 h-full bg-white shadow-xl transform transition-transform ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
      style={{ width: '33.3333%', maxWidth: '400px' }} // 1/3 page or up to 400px
    >
      {/* Close button + Title */}
      <div className="flex justify-between items-center p-4 border-b bg-gray-50">
        <h2 className="text-lg font-bold">Chat Logs</h2>
        <button 
          className="text-gray-600 hover:text-gray-800"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      {/* Log listing */}
      <div className="p-4 overflow-y-auto h-full">
        {isValidArray(logs) ? (
          logs.map((msg, idx) => (
            <div key={idx} className="mb-4">
              <div className="text-sm text-gray-600">
                <strong>{msg.sender}</strong> <em>{msg.date}</em>
              </div>
              <div>{msg.message}</div>
            </div>
          ))
        ) : (
          <p className="text-gray-500">No chat logs found for this day.</p>
        )}
      </div>
    </div>
  );
};

const DaySummariesGrid = ({ summaries, isVisible, onDayClick }) => {
  if (!summaries || summaries.length === 0) return null;
  
  return (
    <div className={`transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'}`}>
      <div className="relative bg-white/50 backdrop-blur-sm shadow-xl w-full max-w-6xl mx-auto rounded-xl p-8">
        <div id="summaries-grid">
          <h2 className="text-2xl font-bold mb-1 text-center">Notable Days</h2>
          <p className="text-base text-gray-600 text-center mb-2">
            Click on a day to relive the chat
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {summaries.map((summary, index) => (
              <div 
                key={index}
                className="bg-white/70 backdrop-blur-sm rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition"
                onClick={() => onDayClick(index)} // pass the index up
              >
                <h3 className="text-xl font-semibold mb-4">{summary.title}</h3>
                <div className="text-gray-700 leading-relaxed">
                  {summary.summary}
                </div>
                <div className="text-right mt-4">
                  <span className="text-gray-400 text-sm">Get your Groupchat Wrapped @ wrapped.chat</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={() => handleExport('summaries-grid', 'clipboard')}
            className="p-2 rounded-full bg-white/80 hover:bg-white transition-colors shadow-sm"
            title="Copy to clipboard"
          >
            <Copy className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={() => handleExport('summaries-grid', 'download')}
            className="p-2 rounded-full bg-white/80 hover:bg-white transition-colors shadow-sm"
            title="Download as PNG"
          >
            <Camera className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Build chart datasets from analysisData
const buildChartDataSets = (analysisData) => {
  if (!analysisData) return [];

  const chartDataSets = [];

  try {
    // Day of Week Chart
    if (isValidArray(analysisData.day_of_week.data)) {
      const labels = analysisData.day_of_week.data.map(d => safeGet(d, 'day_of_week'));
      const values = analysisData.day_of_week.data.map(d => safeGet(d, 'avg_messages', 0));
      const { sortedLabels, sortedData } = sortBarData(labels, values);
      
      chartDataSets.push({
        title: "Average Messages by Day of Week",
        type: "Bar",
        data: {
          labels: sortedLabels,
          datasets: [{
            label: 'Avg Messages by Day of Week',
            data: sortedData,
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
          }]
        },
        commentary: analysisData.day_of_week.caption
      });
    }

    // Monthly Messages Chart
    if (isValidArray(analysisData.monthly_messages.data)) {
      chartDataSets.push({
        title: "Monthly Message Count",
        type: "Line",
        data: {
          labels: analysisData.monthly_messages.data.map(d => safeGet(d, 'date')),
          datasets: [{
            label: 'Messages per Month',
            data: analysisData.monthly_messages.data.map(d => safeGet(d, 'message_count', 0)),
            borderColor: 'rgba(255, 99, 132, 1)',
            fill: false
          }]
        },
        commentary: analysisData.monthly_messages.caption
      });
    }

    // Average Messages Sent Chart
    if (isValidArray(analysisData.avg_messages_sent.data)) {
      chartDataSets.push({
        title: "Average Messages Sent per Month",
        type: "Line",
        data: {
          labels: analysisData.avg_messages_sent.data.map(d => safeGet(d, 'month')),
          datasets: [{
            label: 'Avg Messages per Month',
            data: analysisData.avg_messages_sent.data.map(d => safeGet(d, 'avg_messages_sent', 0)),
            borderColor: 'rgba(75, 192, 192, 1)',
            fill: false
          }]
        },
        commentary: analysisData.avg_messages_sent.caption
      });
    }

    // Quarterly Contribution Chart
    if (isValidArray(analysisData.quarterly_contribution.data)) {
      const quarterData = groupBySender(analysisData.quarterly_contribution.data, 'date', 'message_count');
      if (quarterData.dates.length > 0 && quarterData.datasets.length > 0) {
        chartDataSets.push({
          title: "Quarterly Message Contribution by Sender",
          type: "Line",
          data: {
            labels: quarterData.dates,
            datasets: quarterData.datasets
          },
          commentary: analysisData.quarterly_contribution.caption
        });
      }
    }

    // Yearly Comparison Chart
    if (isValidArray(analysisData.yearly_comparison.data)) {
      const labels = analysisData.yearly_comparison.data.map(d => safeGet(d, 'sender'));
      const values = analysisData.yearly_comparison.data.map(d => safeGet(d, 'percent_change', 0));
      const { sortedLabels, sortedData } = sortBarData(labels, values);
      
      chartDataSets.push({
        title: "Year-Over-Year Message Change",
        type: "Bar",
        data: {
          labels: sortedLabels,
          datasets: [{
            label: 'YoY % Change',
            data: sortedData,
            backgroundColor: 'rgba(153, 102, 255, 0.6)'
          }]
        },
        commentary: analysisData.yearly_comparison.caption
      });
    }

    // Top Ten Days Chart
    if (isValidArray(analysisData.top_ten_days.data)) {
      const labels = analysisData.top_ten_days.data.map(d => safeGet(d, 'day'));
      const values = analysisData.top_ten_days.data.map(d => safeGet(d, 'chats', 0));
      const { sortedLabels, sortedData } = sortBarData(labels, values);
      
      chartDataSets.push({
        title: "Top 10 Most Active Days",
        type: "Bar",
        data: {
          labels: sortedLabels,
          datasets: [{
            label: 'Number of Messages',
            data: sortedData,
            backgroundColor: 'rgba(255, 206, 86, 0.6)'
          }]
        },
        commentary: analysisData.top_ten_days.caption
      });

    }

   
    // Top 3 days summaries

    if (analysisData.top_ten_days?.day_summaries && 
      Array.isArray(analysisData.top_ten_days.day_summaries)) {
      const summaries = analysisData.top_ten_days.day_summaries.map(dayData => ({
        title: String(dayData.date || ''),
        summary: String(dayData.content.summary || ''),
        // If each dayData includes chat_logs, you could store them here:
        chat_logs: dayData.chat_logs || [] 
      })).filter(summary => summary.title && summary.summary);
      
      if (summaries.length > 0) {
        chartDataSets.push({
          type: "SummaryGrid",
          summaries: summaries
        });
      }
    }


    // Manic Data Chart
    if (isValidArray(analysisData.manic.data)) {
      const labels = analysisData.manic.data.map(d => safeGet(d, 'sender'));
      const values = analysisData.manic.data.map(d => safeGet(d, 'percent_manic', 0));
      const { sortedLabels, sortedData } = sortBarData(labels, values);
      
      chartDataSets.push({
        title: "Most Manic Award",
        type: "Bar",
        data: {
          labels: sortedLabels,
          datasets: [{
            label: '% Messages (10pm-4am)',
            data: sortedData,
            backgroundColor: 'rgba(54, 162, 235, 0.6)'
          }]
        },
        commentary: analysisData.manic.caption
      });
    }

    // Most Ignored Chart
    if (isValidArray(analysisData.most_ignored.data)) {
      const labels = analysisData.most_ignored.data.map(d => safeGet(d, 'sender'));
      const values = analysisData.most_ignored.data.map(d => safeGet(d, 'average_time_to_respond', 0));
      const { sortedLabels, sortedData } = sortBarData(labels, values);
      
      chartDataSets.push({
        title: "Most Ignored Member :(",
        type: "Bar",
        data: {
          labels: sortedLabels,
          datasets: [{
            label: 'Average Minutes Until Response',
            data: sortedData,
            backgroundColor: 'rgba(54, 162, 235, 0.6)'
          }]
        },
        commentary: analysisData.most_ignored.caption
      });
    }

    // Novelist Award
    if (isValidArray(analysisData.novelist.data)) {
      const labels = analysisData.novelist.data.map(d => safeGet(d, 'sender'));
      const values = analysisData.novelist.data.map(d => safeGet(d, 'average_message_length', 0));
      const { sortedLabels, sortedData } = sortBarData(labels, values);
      
      chartDataSets.push({
        title: "Groupchat Novelist Award",
        type: "Bar",
        data: {
          labels: sortedLabels,
          datasets: [{
            label: 'Average Characters per Message',
            data: sortedData,
            backgroundColor: 'rgba(54, 162, 235, 0.6)'
          }]
        },
        commentary: analysisData.novelist.caption
      });
    }


    // Swear Data Chart
    if (isValidArray(analysisData.swears.data)) {
      const labels = analysisData.swears.data.map(d => safeGet(d, 'sender'));
      const values = analysisData.swears.data.map(d => safeGet(d, 'swears_per_message', 0));
      const { sortedLabels, sortedData } = sortBarData(labels, values);
      
      chartDataSets.push({
        title: "Swear Word Frequency",
        type: "Bar",
        data: {
          labels: sortedLabels,
          datasets: [{
            label: 'Swears per Message',
            data: sortedData,
            backgroundColor: 'rgba(255, 99, 132, 0.6)'
          }]
        },
        commentary: analysisData.swears.caption
      });
    }

    // Hangout Data Chart
    if (isValidArray(analysisData.hangout.data)) {
      const labels = analysisData.hangout.data.map(d => safeGet(d, 'sender'));
      const values = analysisData.hangout.data.map(d => safeGet(d, 'hangouts_per_message', 0));
      const { sortedLabels, sortedData } = sortBarData(labels, values);
      
      chartDataSets.push({
        title: "Hangout Discussion Frequency",
        type: "Bar",
        data: {
          labels: sortedLabels,
          datasets: [{
            label: 'Hangout References per Message',
            data: sortedData,
            backgroundColor: 'rgba(75, 192, 192, 0.6)'
          }]
        },
        commentary: analysisData.hangout.caption
      });
    }

  chartDataSets.push({
    type: "TextSummaryCard",
    title: "That's all folks!",
    summary: "We wish you and your groupchat the happiest of New Years! We like to have fun around here but all jokes aside, everyone in the groupchat is special, whether it's the guy who always posts videos you're not going to watch, or the old college bud with three kids that hasn't posted since the last one was born (cute pics though.) Shoot 'em a message and let em know you care. Share this Wrapped. Help us keep the lights on <3"
  });
    

  } catch (error) {
    console.error('Error building chart datasets:', error);
  }

  return chartDataSets;
};





const App = () => {
  const [phase, setPhase] = useState('upload');
  const [connectionMethod, setConnectionMethod] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [availableYears, setAvailableYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [currentChartIndex, setCurrentChartIndex] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [error, setError] = useState(null);
  const [createAiSummaries, setCreateAiSummaries] = useState(true);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dayLogs, setDayLogs] = useState([]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      console.log('File selected:', e.target.files[0].name);
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      console.warn('No file selected when attempting upload.');
      return;
    }

    console.log('Starting file read and available-years fetch...');
    setPhase('loading');
    const reader = new FileReader();

    reader.onload = async (ev) => {
      try {
        const fileTranscript = ev.target.result;
        setTranscript(fileTranscript);

        // Fetch available years
        const yearsResponse = await fetch(`${analysisApiUrl}/available-years`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: fileTranscript })
        });

        if (!yearsResponse.ok) throw new Error('Available years fetch not ok');

        const yearsJson = await yearsResponse.json();
        console.log('Available years received:', yearsJson.available_years);

        console.log('Full response:', yearsJson);
        console.log('Type of yearsJson.available_years:', typeof yearsJson.available_years);
        console.log('Is array?', Array.isArray(yearsJson.available_years));
        
        if (!yearsJson.available_years || !Array.isArray(yearsJson.available_years) || yearsJson.available_years.length === 0) {
          throw new Error('No available years found');
        }

        setAvailableYears(yearsJson.available_years);
        const initialYear = yearsJson.available_years[0];
        setSelectedYear(initialYear);

        // Now fetch the analysis for the initial year
        const analyzeResponse = await fetch(`${analysisApiUrl}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: fileTranscript, year: initialYear, create_ai_summaries: createAiSummaries })
        });

        if (!analyzeResponse.ok) throw new Error('Initial analysis fetch not ok');

        const analysisJson = await analyzeResponse.json();
        console.log('Initial analysis data received:', analysisJson);

        setAnalysisData(analysisJson);
        setPhase('visualize');
        setCurrentChartIndex(0);
      } catch (error) {
        console.error('Error processing file:', error);
        setError('Analysis failed');
        setPhase('upload');
      }
    };

    reader.onerror = () => {
      console.error('Error reading file');
      setError('Failed to read file');
      setPhase('upload');
    };

    reader.readAsText(selectedFile);
  };

  const handleYearChange = async (year) => {
    console.log('Year selected:', year);
    setSelectedYear(year);
    setPhase('loading');

    try {
      const response = await fetch(`${analysisApiUrl}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, year, create_ai_summaries: createAiSummaries })
      });

      if (!response.ok) throw new Error('Failed to fetch analysis data for year');

      const json = await response.json();
      console.log('Analysis data for selected year:', json);
      setAnalysisData(json);
      setPhase('visualize');
      setCurrentChartIndex(0);
    } catch (error) {
      console.error('Error fetching data for year:', error);
      setError('Failed to fetch data for year');
      setPhase('error');
    }
  };

  const handleDaySummaryClick = (dayIndex) => {
    // Grab the Summaries item from analysisData
    const chartDataSets = buildChartDataSets(analysisData) || [];
    const summaryItem = chartDataSets.find(c => c.type === 'SummaryGrid');
    if (!summaryItem || !summaryItem.summaries[dayIndex]) return;
  
    // Access chat_logs for that day
    const logsForDay = summaryItem.summaries[dayIndex].chat_logs || [];
    console.log('Opening drawer with logs:', logsForDay);
  
    setDayLogs(logsForDay);
    setDrawerOpen(true);
  };
  
  // Then render the side drawer
  <DayChatLogsDrawer
    isOpen={drawerOpen}
    logs={dayLogs}
    onClose={() => setDrawerOpen(false)}
  />;

  

  const handleScroll = (e) => {
    if (isScrolling || !analysisData) return;

    const chartDataSets = buildChartDataSets(analysisData);
    if (!chartDataSets.length) return;

    setIsScrolling(true);

    if (e.deltaY > 0 && currentChartIndex < chartDataSets.length - 1) {
      setCurrentChartIndex((prev) => prev + 1);
    } else if (e.deltaY < 0 && currentChartIndex > 0) {
      setCurrentChartIndex((prev) => prev - 1);
    }

    setTimeout(() => setIsScrolling(false), 700);
  };

  // Render logic
  if (phase === 'upload') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="w-full max-w-xl p-8 bg-white/70 backdrop-blur-sm rounded-xl shadow-lg">
          {error && (
            <div className="mb-6 p-1 bg-red-50 text-red-700 rounded-lg">
              {error}
            </div>
          )}
          <h1 className="text-3xl font-bold text-center mb-8">Groupchat Wrapped 2024</h1>
          <img src="/giftbox_opening.gif" alt="Opening Giftbox" />
          {!connectionMethod ? (
            <div className="space-y-0">
              <p className="text-gray-600 mb-8 p-1" align="center">
                It's been quite a year huh? Let's review! To get started, click the button below to import your groupchat data.
                Don't worry - we won't save anything beyond this session.
              </p>
              <button
                onClick={() => setConnectionMethod('file')}
                className="w-full p-6 text-left border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition-colors"
              >
                <h2 className="text-xl font-semibold mb-2">Upload Chat File</h2>
                <p className="text-gray-600">Export your chat from WhatsApp and upload the file</p>
              </button>
            </div>
          ) : (
            <div>
              <button
                onClick={() => {
                  setConnectionMethod(null);
                  setError(null);
                }}
                className="mb-6 text-gray-600 hover:text-gray-800"
              >
                ← Back to options
              </button>
              {connectionMethod === 'file' ? (
                <div className="space-y-4">
                  <p className="text-gray-600" align="center">
                    <a
                      href="https://faq.whatsapp.com/1180414079177245/?cms_platform=iphone&helpref=platform_switcher&locale=en_US"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      To learn how to export your chat history from WhatsApp, click here.
                    </a>{' '}
                    You don't need to attach media.
                  </p>
                  <label className="block w-full px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:border-blue-500 transition-colors">
                    <input
                      type="file"
                      accept=".txt"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <span className="text-gray-600">
                      {selectedFile ? selectedFile.name : 'Drop your WhatsApp chat file here or click to browse'}
                    </span>
                  </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="aiSummariesCheckbox"
                    checked={createAiSummaries}
                    onChange={(e) => setCreateAiSummaries(e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <label htmlFor="aiSummariesCheckbox" className="text-gray-700 text-sm">
                    For part of our analysis, some chat segments will be sent to OpenAI. Names within the transcripts will be anonymized before sending to OpenAI (if you want to see how this works, <a href = 'https://github.com/GOliveira10/groupchat-wrapped-analysis/blob/main/plumber.R'> click here to check the code.) </a>
                    If you'd still like to skip this part, check the box.
                  </label>
                </div>

                  {selectedFile && (
                    <button
                      onClick={handleFileUpload}
                      className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Analyze Chat
                    </button>
                  )}
                </div>
              ) : (
                null
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'loading') {
    // Show a loading screen while waiting for available-years or analyze calls
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-indigo-600 mx-auto mb-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10"
                    stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
          <p className="text-indigo-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (phase === 'visualize') {
    // Build out the chart items (Bar charts, Line charts, SummaryGrid, etc.)
    const chartDataSets = buildChartDataSets(analysisData);
    if (!chartDataSets || chartDataSets.length === 0) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 max-w-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">No data available for visualization</p>
              </div>
            </div>
          </div>
        </div>
      );
    }
  
    // Safeguard the index of whichever chart or item is in view
    const safeCurrentIndex = Math.max(0, Math.min(currentChartIndex, chartDataSets.length - 1));
    // The current chart or summary in the sequence
    const currentItem = chartDataSets[safeCurrentIndex];
    // Whether to show the "scroll down" indicator
    const showScrollIndicator = safeCurrentIndex < chartDataSets.length - 1;
  
    return (
      <>
        {/* Main content container */}
        <div
          className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-8"
          onWheel={handleScroll}
        >
          {/* Year dropdown (top-left) */}
          <div className="fixed top-4 left-4 bg-white/80 backdrop-blur-sm rounded-lg p-2 shadow">
            <label htmlFor="yearDropdown" className="block text-sm font-medium text-gray-700">
              Select Year:
            </label>
            <select
              id="yearDropdown"
              value={selectedYear}
              onChange={(e) => handleYearChange(e.target.value)}
              className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm 
                         focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
  
          {/* "X of Y" chart indicator (top-right) */}
          <div className="fixed top-4 right-4 bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 text-sm text-gray-600">
            {safeCurrentIndex + 1} of {chartDataSets.length}
          </div>
  
          {/* The main area where we display the current chart or summary */}
          <div className="w-full">
            {/* We switch on item type: 'SummaryGrid', 'Bar'/'Line' chart, 'TextSummaryCard', etc. */}
            {currentItem && (
              currentItem.type === 'SummaryGrid' ? (
                <DaySummariesGrid 
                  summaries={currentItem.summaries} 
                  isVisible 
                  onDayClick={handleDaySummaryClick}    // <--- IMPORTANT for drawer
                />
              ) : currentItem.data ? (
                <AnimatedChart 
                  chart={currentItem} 
                  isVisible 
                  index={safeCurrentIndex} 
                />
              ) : currentItem.type === 'TextSummaryCard' ? (
                <TextSummaryCard 
                  title={currentItem.title} 
                  summary={currentItem.summary} 
                  isVisible 
                />
              ) : null
            )}
          </div>
  
          {/* "Scroll Down" indicator on the right, if more charts remain */}
          {showScrollIndicator && <ScrollIndicator showIndicator />}
        </div>
  
        {/* The side drawer for day logs (placed outside the .min-h-screen container) */}
        <DayChatLogsDrawer
          isOpen={drawerOpen}
          logs={dayLogs}
          onClose={() => setDrawerOpen(false)}
        />
      </>
    );
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-red-50 text-red-700">
        <p>{error || 'An error occurred.'}</p>
      </div>
    );
  }

  // If we ever get here, something unexpected truly happened.
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-red-50 text-red-700">
      <p>Unexpected state. Please reload the page.</p>
    </div>
  );
};

export default App;
