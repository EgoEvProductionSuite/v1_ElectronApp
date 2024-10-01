// electron-app/renderer/src/App.jsx

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircleIcon,
  ClockIcon,
  BoltIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon, // Import for Suspended Status
  PowerIcon,
  FireIcon,
} from '@heroicons/react/24/solid';
import logo from '../../../assets/images/logo.png'; // Corrected path

// PulseAnimation Component for "Available" Status
const PulseAnimation = () => {
  return (
    <motion.div
      style={styles.pulseCircle}
      animate={{
        scale: [1, 1.5, 1], // Scale up then back to original
        opacity: [1, 0.5, 1], // Adjust opacity for a fading effect
      }}
      transition={{
        duration: 1.5, // Time for each pulse
        ease: "easeInOut", // Easing for smooth effect
        repeat: Infinity, // Keep pulsing indefinitely
        repeatType: "loop", // Looping the animation
      }}
    />
  );
};

// StatusIndicator Component to handle different statuses
const StatusIndicator = ({ iconInfo }) => {
  const IconComponent = iconInfo.icon;

  if (iconInfo.variant === 'pulse') {
    return (
      <div style={styles.statusIndicatorContainer}>
        <PulseAnimation />
        <IconComponent style={{ ...styles.statusIcon, color: iconInfo.color }} />
      </div>
    );
  } else {
    return (
      <IconComponent style={{ ...styles.statusIcon, color: iconInfo.color }} />
    );
  }
};

// Status icons configuration
const statusIcons = {
  available: {
    icon: CheckCircleIcon,
    color: '#22c55e', // Tailwind green-500 equivalent
    variant: 'pulse',
  },
  charging: {
    icon: BoltIcon,
    color: '#3b82f6', // Tailwind blue-500 equivalent
    variant: 'none',
  },
  preparing: {
    icon: ClockIcon,
    color: '#ec4899', // Tailwind pink-500 equivalent
    variant: 'none',
  },
  suspendedev: { // Correct key as per your data
    icon: ExclamationTriangleIcon, // Triangle Exclamation Icon for Suspended Status
    color: '#ef4444', // Tailwind red-500 equivalent
    variant: 'none',
  },
  unknown: { // Fallback for any undefined statuses
    icon: ExclamationCircleIcon,
    color: '#f59e0b', // Tailwind yellow-500 equivalent
    variant: 'none',
  },
};

// Main App Component
const App = () => {
  const [chargers, setChargers] = useState([]);
  const [error, setError] = useState(null);

  // Fetch data on button click
  const fetchData = async () => {
    try {
      const data = await window.api.getChargerData();
      if (data.success === false) {
        setError(data.message);
      } else {
        setChargers(data.devices);
        setError(null);
      }
    } catch (err) {
      setError(err.toString());
    }
  };

  // Listen for real-time updates
  useEffect(() => {
    const handleChargerData = (message) => {
      if (message.event === 'charger_status_update') {
        setChargers((prevChargers) => {
          const existingIndex = prevChargers.findIndex(
            (c) => c.ip === message.data.ip
          );
          if (existingIndex !== -1) {
            // Update existing charger
            const updatedChargers = [...prevChargers];
            updatedChargers[existingIndex] = message.data;
            return updatedChargers;
          } else {
            // Add new charger
            return [...prevChargers, message.data];
          }
        });
      }
    };

    window.api.onChargerData(handleChargerData);

    // Cleanup listener on unmount
    return () => {
      // Currently, there's no method to remove the listener; consider implementing it in preload.js if needed
    };
  }, []);

  return (
    <div style={styles.container}>
      {/* Logo and Title */}
      <header style={styles.header}>
        <img src={logo} alt="EGO EV Logo" style={styles.logo} />
        <h1 style={styles.title}>EGO EV 7.2 kW Single Phase Charger</h1>
      </header>

      {/* Refresh Button */}
      <motion.button
        onClick={fetchData}
        style={styles.refreshButton}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        Refresh Data
      </motion.button>

      {/* Error Message */}
      {error && (
        <div style={styles.errorMessage}>
          <ExclamationCircleIcon style={styles.errorIcon} />
          <span>{error}</span>
        </div>
      )}

      {/* Charger List */}
      <div style={styles.chargerList}>
        {chargers && chargers.length > 0 ? (
          chargers.map((charger) => {
            const status = charger.status.toLowerCase().trim();
            const iconInfo = statusIcons[status] || statusIcons['unknown'];
            const IconComponent = iconInfo.icon;

            return (
              <motion.div
                key={charger.ip}
                style={styles.chargerCard}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                {/* Charger Header */}
                <div style={styles.chargerHeader}>
                  <div>
                    <h2 style={styles.chargerTitle}>
                      {charger.hostname_info} ({charger.ip})
                    </h2>
                  </div>
                  {/* Status Indicator */}
                  <div style={styles.statusIndicator}>
                    <StatusIndicator iconInfo={iconInfo} />
                    <span style={{ ...styles.statusText, color: iconInfo.color }}>
                      {charger.status}
                    </span>
                  </div>
                </div>

                {/* Charger Details */}
                <div style={styles.chargerDetails}>
                  <div style={styles.detailItem}>
                    <FireIcon style={styles.detailIcon} />
                    <span>
                      <strong>System Temperature:</strong> {charger.system_temp}°C
                    </span>
                  </div>
                  <div style={styles.detailItem}>
                    <BoltIcon style={styles.detailIcon} />
                    <span>
                      <strong>AC Voltage:</strong> {charger.ac_voltage} V
                    </span>
                  </div>
                  <div style={styles.detailItem}>
                    <BoltIcon style={styles.detailIcon} />
                    <span>
                      <strong>Available Power:</strong> {charger.available_power} W
                    </span>
                  </div>
                  <div style={styles.detailItem}>
                    <PowerIcon style={styles.detailIcon} />
                    <span>
                      <strong>Current:</strong> {charger.current} A
                    </span>
                  </div>
                  <div style={styles.detailItem}>
                    <CheckCircleIcon style={styles.detailIcon} />
                    <span>
                      <strong>Energy:</strong> {charger.energy} kWh
                    </span>
                  </div>
                  <div style={styles.detailItem}>
                    <ClockIcon style={styles.detailIcon} />
                    <span>
                      <strong>EVSE Connector Type:</strong> {charger.evse_connector_type}
                    </span>
                  </div>
                  <div style={styles.detailItem}>
                    <ExclamationTriangleIcon style={styles.detailIcon} />
                    <span>
                      <strong>EVSE PP State:</strong> {charger.evse_pp_state}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })
        ) : (
          <p style={styles.noChargerText}>No chargers found.</p>
        )}
      </div>
    </div>
  );
};

// Inline styles for simplicity
const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f3f4f6', // Equivalent to Tailwind gray-100
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '40px',
  },
  logo: {
    width: '420px', // Adjusted size for better fit
    height: '280px',
    marginBottom: '16px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#1f2937', // Equivalent to Tailwind gray-800
    textAlign: 'center',
  },
  refreshButton: {
    marginBottom: '24px',
    padding: '12px 24px',
    backgroundColor: '#3b82f6', // Equivalent to Tailwind blue-500
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },
  errorMessage: {
    display: 'flex',
    alignItems: 'center',
    color: '#ef4444', // Equivalent to Tailwind red-500
    marginBottom: '20px',
  },
  errorIcon: {
    width: '20px',
    height: '20px',
    marginRight: '8px',
  },
  chargerList: {
    width: '100%',
    maxWidth: '1024px',
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '24px',
  },
  chargerCard: {
    backgroundColor: '#ffffff',
    padding: '24px',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  chargerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chargerTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#374151', // Equivalent to Tailwind gray-700
  },
  statusIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statusIndicatorContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  pulseCircle: {
    width: 30, // Increased size for better visibility
    height: 30,
    borderRadius: '50%',
    backgroundColor: '#22c55e', // Green color for "Available" status
  },
  statusIcon: {
    width: '30px', // Match the size of pulseCircle
    height: '30px',
  },
  statusText: {
    fontSize: '16px',
    fontWeight: '500',
  },
  chargerDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  detailItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '16px',
    color: '#4b5563', // Equivalent to Tailwind gray-600
  },
  detailIcon: {
    width: '20px',
    height: '20px',
  },
  noChargerText: {
    fontSize: '18px',
    color: '#6b7280', // Equivalent to Tailwind gray-500
  },
};

export default App;
