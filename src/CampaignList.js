// CampaignList.js - Component για την εμφάνιση λίστας καμπανιών
import React from 'react';
// Εισαγωγή του PropTypes για έλεγχο των props
import PropTypes from 'prop-types';

// Functional component που δέχεται διάφορα props για την εμφάνιση και διαχείριση των καμπανιών
const CampaignList = ({ 
  campaigns, // Λίστα καμπανιών προς εμφάνιση
  onPledge, // Function που καλείται όταν κάποιος κάνει pledge
  onCancel, // Function για ακύρωση καμπάνιας
  onFulfill, // Function για ολοκλήρωση καμπάνιας
  currentAddress, // Η τρέχουσα διεύθυνση του χρήστη
  readonly, // Flag για το αν η λίστα είναι μόνο για ανάγνωση
  ownerAddress, // Η διεύθυνση του ιδιοκτήτη
  userShares, // Οι μετοχές του χρήστη
  hasAdminRights // Flag για το αν ο χρήστης έχει δικαιώματα διαχειριστή
}) => {
  // Ελέγχει αν ο χρήστης μπορεί να ακυρώσει ή να ολοκληρώσει μια καμπάνια
  const canCancelOrFulfillCampaign = (campaign) => {
    if (!currentAddress || !ownerAddress || !campaign?.entrepreneur) {
      return false;
    }
    
    // Επιτρέπεται μόνο στον επιχειρηματία ή σε διαχειριστές
    const isEntrepreneur = currentAddress.toLowerCase() === campaign.entrepreneur.toLowerCase();
    return hasAdminRights || isEntrepreneur;
  };

  // Αν δεν υπάρχουν καμπάνιες, εμφάνιση κενού πίνακα
  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Entrepreneur</th>
              <th>Title</th>
              <th>Share Details</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan="4" className="text-center">
                No campaigns in this category
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  // Κύρια εμφάνιση του πίνακα με τις καμπάνιες
  return (
    <div className="table-responsive">
      <table className="table">
        <thead>
          <tr>
            <th>Entrepreneur</th>
            <th>Title</th>
            <th>Share Details</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {/* Επανάληψη για κάθε καμπάνια */}
          {campaigns.map(campaign => {
            // Υπολογισμός υπολειπόμενων μετοχών
            const pledgesLeft = parseInt(campaign.sharesNeeded) - parseInt(campaign.sharesCount);

            return (
              <tr key={campaign.id}>
                <td>{campaign.entrepreneur}</td>
                <td>{campaign.title}</td>
                {/* Εμφάνιση λεπτομερειών για τις μετοχές */}
                <td>
                  <div>Price: {campaign.shareCost} ETH</div>
                  <div>Sold: {campaign.sharesCount} shares</div>
                  <div>Left: {pledgesLeft} shares</div>
                  <div>Your shares: {userShares?.[campaign.id] || '0'}</div>
                </td>
                {/* Κουμπιά ενεργειών */}
                <td>
                  {!readonly && (
                    <div className="btn-group">
                      {/* Κουμπί για pledge */}
                      <button 
                        className="btn btn-success btn-sm mr-2"
                        onClick={(event) => onPledge(campaign.id, event)}
                      >
                        Pledge
                      </button>
                      
                      {/* Κουμπί ακύρωσης (μόνο για επιχειρηματία/διαχειριστή) */}
                      {canCancelOrFulfillCampaign(campaign) && (
                        <button 
                          className="btn btn-danger btn-sm mr-2"
                          onClick={() => onCancel(campaign.id)}
                        >
                          Cancel
                        </button>
                      )}

                      {/* Κουμπί ολοκλήρωσης (μόνο όταν έχουν πωληθεί όλες οι μετοχές) */}
                      {canCancelOrFulfillCampaign(campaign) && 
                       parseInt(campaign.sharesCount) === parseInt(campaign.sharesNeeded) && (
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => onFulfill(campaign.id)}
                        >
                          Fulfill
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// Ορισμός των τύπων των props για καλύτερο debugging
CampaignList.propTypes = {
  campaigns: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    entrepreneur: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    shareCost: PropTypes.string.isRequired,
    sharesNeeded: PropTypes.string.isRequired,
    sharesCount: PropTypes.string.isRequired,
    investments: PropTypes.object.isRequired
  })).isRequired,
  onPledge: PropTypes.func,
  onCancel: PropTypes.func,
  onFulfill: PropTypes.func,
  currentAddress: PropTypes.string,
  readonly: PropTypes.bool,
  ownerAddress: PropTypes.string,
  userShares: PropTypes.objectOf(PropTypes.string),
  hasAdminRights: PropTypes.bool
};

// Προεπιλεγμένες τιμές για τα props
CampaignList.defaultProps = {
  onPledge: () => {},
  onCancel: () => {},
  onFulfill: () => {},
  userShares: {} 
};

export default CampaignList;