import PropTypes from 'prop-types';
import { formatTime, formatPace } from '../utils/formatters';
import { useEffect, useState } from 'react';

const SplitsTable = ({ splits, distanceUnit }) => {
  const [visibleColumns, setVisibleColumns] = useState({
    distance: true,
    time: true,
    pace: true
  });

  // Responsive column management based on screen size
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 360) { // Very small screens
        setVisibleColumns({
          distance: true,
          time: true,
          pace: false
        });
      } else { // Larger screens
        setVisibleColumns({
          distance: true,
          time: true,
          pace: true
        });
      }
    };

    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Add a check for missing splits
  if (!splits || splits.length === 0) {
    return <div>No split data available</div>;
  }

  // Ensure we're displaying the correct unit in the header
  const distanceHeader = `${distanceUnit.toUpperCase()}`;

  return (
    <div className="splits-table-container">
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {visibleColumns.distance && (
              <th>{distanceHeader}</th>
            )}
            {visibleColumns.time && (
              <th>Time</th>
            )}
            {visibleColumns.pace && (
              <th>Pace (min/{distanceUnit})</th>
            )}
          </tr>
        </thead>
        <tbody>
          {splits.map((split, index) => (
            <tr key={index} style={split.isPartial ? { opacity: 0.7 } : {}}>
              {visibleColumns.distance && (
                <td>{split.km}{split.isPartial ? '*' : ''}</td>
              )}
              {visibleColumns.time && (
                <td>
                  {Math.floor(split.time / 60)}:
                  {(split.time % 60).toString().padStart(2, '0')}
                </td>
              )}
              {visibleColumns.pace && (
                <td>
                  {Math.floor(split.pace * 60)}:
                  {Math.round((split.pace * 60) % 60).toString().padStart(2, '0')}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {splits.some(split => split.isPartial) && (
        <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', textAlign: 'right' }}>
          * Partial split
        </div>
      )}
    </div>
  );
};

SplitsTable.propTypes = {
  splits: PropTypes.arrayOf(
    PropTypes.shape({
      time: PropTypes.number.isRequired,
      pace: PropTypes.number.isRequired
    })
  ),
  distanceUnit: PropTypes.oneOf(['km', 'mi'])
};

SplitsTable.defaultProps = {
  splits: [],
  distanceUnit: 'km'
};

export default SplitsTable; 