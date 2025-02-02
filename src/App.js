// App.js - Το κύριο component της εφαρμογής
// App.js - Το κύριο component της εφαρμογής
import React, { Component } from 'react';
// Εισαγωγή του Bootstrap CSS για στυλιστική μορφοποίηση
import 'bootstrap/dist/css/bootstrap.css';
// Εισαγωγή των απαραίτητων modules για αλληλεπίδραση με το blockchain
import web3 from './web3';
import crowdfunding from './crowdfunding';
// Εισαγωγή του component που εμφανίζει τη λίστα των καμπανιών
import CampaignList from './CampaignList';

// Κύρια κλάση της εφαρμογής που κληρονομεί από το React.Component
class App extends Component {
  // Αρχική κατάσταση (state) της εφαρμογής
  state = {
    currentAddress: '', // Η τρέχουσα διεύθυνση του χρήστη στο blockchain
    ownerAddress: '', // Η διεύθυνση του ιδιοκτήτη του smart contract
    balance: '0', // Το συνολικό ποσό ETH στο smart contract
    collectedFees: '0', // Τα συλλεχθέντα fees του ιδιοκτήτη
    // Αντικείμενο που περιέχει τις καμπάνιες χωρισμένες σε κατηγορίες
    campaigns: {
      active: [], // Ενεργές καμπάνιες
      fulfilled: [], // Ολοκληρωμένες καμπάνιες
      canceled: [] // Ακυρωμένες καμπάνιες
    },
    // Δεδομένα για τη δημιουργία νέας καμπάνιας
    newCampaign: {
      title: '',
      pledgeCost: '',
      numberOfPledges: ''
    },
    message: '', // Μήνυμα για ενημέρωση του χρήστη
    isCreatingCampaign: false, // Flag για το αν δημιουργείται καμπάνια
    userShares: [], // Αριθμός μετοχών του χρήστη για κάθε καμπάνια
    userCampaigns: [], // IDs των καμπανιών στις οποίες συμμετέχει ο χρήστης
    newOwnerAddress: '', // Νέα διεύθυνση ιδιοκτήτη (για αλλαγή)
    bannedEntrepreneurAddress: '', // Διεύθυνση επιχειρηματία προς αποκλεισμό
    isBanned: false, // Flag για το αν ο χρήστης είναι αποκλεισμένος
    isContractDestroyed: false // Flag για το αν το contract έχει καταστραφεί
  };

  // Καλείται αυτόματα όταν το component "μονταριστεί" στη σελίδα
  async componentDidMount() {
    await this.initializeBlockchainData(); // Αρχικοποίηση δεδομένων blockchain
    this.setupMetaMaskListeners(); // Ρύθμιση listeners για το MetaMask
    // Ρύθμιση listeners για τα events του smart contract
    if (!this.eventListenersSet) {
      this.setupContractEventListeners();
      this.eventListenersSet = true;
    }
  }
  
  // Καλείται όταν το component πρόκειται να αφαιρεθεί από τη σελίδα
  componentWillUnmount() {
    // Αφαίρεση των MetaMask listeners
    if (window.ethereum) {
      window.ethereum.removeListener('accountsChanged', this.handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', this.handleChainChanged);
    }
    this.unsubscribeFromEvents(); // Αφαίρεση των contract event listeners
  }

  // Ρύθμιση των listeners για τα events του smart contract
  setupContractEventListeners = () => {
      // Έλεγχος αν το contract έχει events
      if (!crowdfunding.events) {
        console.error('No events found in contract');
        return;
      }
  
      // CampaignCreated event
      crowdfunding.events.CampaignCreated()
      .on('data', async (data) => {
        console.log('New campaign created:', data.returnValues);
        await this.updateBlockchainData(this.state.currentAddress);
      })

      // CampaignFunded event
      crowdfunding.events.CampaignFunded()
      .on('data', async (data) => {
        console.log('Campaign funded:', data.returnValues);
        await this.updateBlockchainData(this.state.currentAddress);
      })

      // CampaignCancelled event
      crowdfunding.events.CampaignCancelled()
      .on('data', async (data) => {
        console.log('Campaign cancelled:', data.returnValues);
        await this.updateBlockchainData(this.state.currentAddress);
      })
  
      // BackerRefunded event
      crowdfunding.events.CampaignFulfilled()
      .on('data', async (data) => {
        console.log('Campaign fulfilled:', data.returnValues);
        await this.updateBlockchainData(this.state.currentAddress);
      })
  
      // CampaignFulfilled event
      crowdfunding.events.BackerRefunded()
      .on('data', async (data) => {
        console.log('Backer refunded:', data.returnValues);
        await this.updateBlockchainData(this.state.currentAddress);
      })

      //Fees withdrawn event
      crowdfunding.events.feesWithdrawn()
      .on('data', async (event) => {
        console.log("Fees withdrawn by owner:", event.returnValues._owner, "Amount:", event.returnValues.funds);
        await this.updateBlockchainData(this.state.currentAddress);
      })

      //Owner changed event
      crowdfunding.events.ownerChanged()
      .on('data', async (event) => {
        console.log("Contract owner changed to:", event.returnValues._newOwner);
        await this.updateBlockchainData(this.state.currentAddress);
      })

      //Address Banned event
      crowdfunding.events.addressBanned()
      .on('data', async (event) => {
        console.log("Address banned:", event.returnValues._bannedAddress);
        await this.updateBlockchainData(this.state.currentAddress);
      })

      // Destroyed contract event
      crowdfunding.events.destroyedContract()
      .on('data', async (event) => {
        console.log("Contract destroyed status:", event.returnValues.destroyed);
        await this.updateBlockchainData(this.state.currentAddress);
      })

  }
  
  // Απεγγραφή από τα blockchain events όταν το component καταστρέφεται
  unsubscribeFromEvents = () => {
    if (this.eventSubscriptions) {
      this.eventSubscriptions.forEach(subscription => {
        subscription?.unsubscribe();
      });
    }
  }

  // Αρχικοποίηση των δεδομένων του blockchain
  // Συνδέεται με το MetaMask και φορτώνει τα απαραίτητα δεδομένα
  initializeBlockchainData = async () => {
    try {
      // Ζητάει πρόσβαση στους λογαριασμούς του MetaMask
      const accounts = await web3.eth.requestAccounts();
      if (!accounts.length) {
        throw new Error("No accounts found. Please connect MetaMask.");
      }
      // Ενημερώνει τα δεδομένα με τον τρέχοντα λογαριασμό
      await this.updateBlockchainData(accounts[0]);
    } catch (error) {
      this.setState({ message: `Failed to load web3, accounts, or contract: ${error.message}` });
    }
  };

  // Ενημερώνει όλα τα δεδομένα του blockchain για την εφαρμογή
  updateBlockchainData = async (currentAddress) => {
    try {
      // Λήψη της διεύθυνσης του ιδιοκτήτη του smart contract
      const ownerAddress = await crowdfunding.methods.owner().call();
      // Λήψη του υπολοίπου του contract σε Wei
      const balanceWei = await web3.eth.getBalance(crowdfunding.options.address);
      // Λήψη των συλλεχθέντων fees
      const collectedFees = await crowdfunding.methods.ownerFunds().call();
  
      // Μετατροπή των ποσών από Wei σε Ether
      const balance = web3.utils.fromWei(balanceWei, 'ether');
      const fees = web3.utils.fromWei(collectedFees, 'ether');
  
      // Φόρτωση όλων των καμπανιών ανά κατηγορία
      const activeCampaigns = await this.loadCampaigns('active');
      const fulfilledCampaigns = await this.loadCampaigns('fulfilled');
      const canceledCampaigns = await this.loadCampaigns('canceled');
      // Φόρτωση των μεριδίων του τρέχοντος χρήστη
      const userShares = await this.loadUserShares(currentAddress);

      // Έλεγχος αν ο χρήστης είναι σε λίστα απαγόρευσης
      const bannedAddresses = await crowdfunding.methods.getBannedBackers().call();
      const isBanned = bannedAddresses
          .map(address => address.toLowerCase())  
          .includes(currentAddress.toLowerCase());

      // Έλεγχος αν το contract έχει καταστραφεί
      const isContractDestroyed = await crowdfunding.methods.contractDestroyed().call();

      // Ενημέρωση του state με όλα τα νέα δεδομένα
      this.setState({
        currentAddress,
        ownerAddress,
        balance,
        collectedFees: fees,
        campaigns: {
          active: activeCampaigns,
          fulfilled: fulfilledCampaigns,
          canceled: canceledCampaigns
        },
        userShares,
        isBanned,
        isContractDestroyed
      });
    } catch (error) {
      console.error('Error updating blockchain data:', error);
      this.setState({ 
        message: 'Failed to update blockchain data.',
        userShares: {}
      });
    }
  };
  
  // Ρύθμιση των listeners για τις αλλαγές στο MetaMask
  setupMetaMaskListeners = () => {
    if (window.ethereum) {
      // Παρακολούθηση αλλαγών στους συνδεδεμένους λογαριασμούς
      window.ethereum.on('accountsChanged', this.handleAccountsChanged);
      // Παρακολούθηση αλλαγών στο blockchain network
      window.ethereum.on('chainChanged', this.handleChainChanged);
    }
  };

  // Χειρισμός αλλαγών στους λογαριασμούς του MetaMask
  handleAccountsChanged = async (accounts) => {
    if (accounts.length === 0) {
      this.setState({ message: 'Please connect to MetaMask.' });
    } else {
      await this.updateBlockchainData(accounts[0]);
    }
  };

  // Επαναφόρτωση της σελίδας όταν αλλάζει το blockchain network
  handleChainChanged = () => {
    window.location.reload();
  };

  // Έλεγχος αν ο τρέχων χρήστης έχει δικαιώματα διαχειριστή
  hasAdminRights = () => {
    const ADMIN_ADDRESS = '0x153dfef4355E823dCB0FCc76Efe942BefCa86477'.toLowerCase();
    const currentAddress = this.state.currentAddress.toLowerCase();
    const ownerAddress = this.state.ownerAddress.toLowerCase();
    
    return currentAddress === ownerAddress || currentAddress === ADMIN_ADDRESS;
  };

  // Φόρτωση καμπανιών ανά τύπο (ενεργές, ολοκληρωμένες, ακυρωμένες)
  loadCampaigns = async (type) => {
    try {
      let campaignIds;
      // Επιλογή της κατάλληλης μεθόδου βάσει του τύπου
      switch(type) {
        case 'active':
          campaignIds = await crowdfunding.methods.getActiveCampaigns().call();
          break;
        case 'fulfilled':
          campaignIds = await crowdfunding.methods.getFulfiledCampaigns().call();
          break;
        case 'canceled':
          campaignIds = await crowdfunding.methods.getCancelledCampaigns().call();
          break;
        default:
          return [];
      }
  
      // Φιλτράρισμα των μη-μηδενικών campaign IDs
      campaignIds = campaignIds.filter(id => id !== 0n);
  
      const campaigns = await Promise.all(
        campaignIds.map(async (id) => {
          const campaign = await crowdfunding.methods.getCampaignInfo(id).call();
          const backersData = await crowdfunding.methods.getCampaignBackers(id).call();
          const backers = backersData?.backers || [];
          const investments = backersData?.investments || [];
  
          return {
            id: campaign[0],
            entrepreneur: campaign[1],
            title: campaign[2],
            shareCost: web3.utils.fromWei(campaign[3].toString(), 'ether'),
            sharesNeeded: campaign[4],
            sharesCount: campaign[5],
            fulfilled: campaign[6],
            cancelled: campaign[7],
            backers,
            investments
          };
        })
      );
  
      // Φιλτράρισμα μη έγκυρων καμπανιών
      return campaigns.filter(c => 
        c.entrepreneur !== '0x0000000000000000000000000000000000000000' &&
        c.title !== '' && 
        parseInt(c.sharesNeeded) > 0
      );
    } catch (error) {
      console.error('Error in loadCampaigns:', error);
      return [];
    }
  }

  // Φόρτωση των μεριδίων ενός χρήστη σε όλες τις καμπάνιες
  loadUserShares = async (address) => {
    try {
      const result = await crowdfunding.methods
        .getBackerShares(address)
        .call();
      
      const sharesMap = {};
      const campaignIds = result[0];
      const shares = result[1];
  
      // Δημιουργία map με τα μερίδια ανά καμπάνια
      if (campaignIds.length === shares.length) {
        for (let i = 0; i < campaignIds.length; i++) {
          const campaignId = campaignIds[i].toString();
          const shareCount = shares[i].toString();
          
          if (campaignId !== '0' && shareCount !== '0') {
            sharesMap[campaignId] = shareCount;
          }
        }
      }
  
      return sharesMap;
  
    } catch (error) {
      console.error('Error loading user shares:', error);
      return {};
    }
  };

  // Δημιουργία νέας καμπάνιας
  createCampaign = async (event) => {
    event.preventDefault();
    const { title, pledgeCost, numberOfPledges } = this.state.newCampaign;

    // Βασικοί έλεγχοι εγκυρότητας
    if (!title || !pledgeCost || !numberOfPledges) {
      this.setState({ message: 'Please fill in all fields' });
      return;
    }

    // Έλεγχος για μοναδικό τίτλο
    const allCampaigns = [
      ...this.state.campaigns.active,
      ...this.state.campaigns.fulfilled,
      ...this.state.campaigns.canceled
    ];

    if (allCampaigns.some(campaign => campaign.title === title)) {
      this.setState({ message: 'Campaign title must be unique' });
      return;
    }

    // Έλεγχος αν ο χρήστης είναι σε λίστα απαγόρευσης
    try {
      const bannedAddresses = await crowdfunding.methods.getBannedBackers().call();
      if (bannedAddresses.includes(this.state.currentAddress)) {
        this.setState({ message: 'You are banned from creating campaigns.' });
        return;
      }
    } catch (error) {
      console.error('Error checking banned addresses:', error);
      this.setState({ message: 'Failed to check banned status.' });
      return;
    }

    this.setState({ isCreatingCampaign: true, message: 'Creating new campaign...' });

    try {
      // Κλήση του smart contract για δημιουργία καμπάνιας
      await crowdfunding.methods.createCampaign(
        title,
        web3.utils.toWei(pledgeCost, 'ether'),
        numberOfPledges
      ).send({
        from: this.state.currentAddress,
        value: web3.utils.toWei('0.02', 'ether')  // Τέλος δημιουργίας καμπάνιας
      });

      // Καθαρισμός φόρμας και ενημέρωση
      this.setState({
        message: 'Campaign created successfully!',
        newCampaign: {
          title: '',
          pledgeCost: '',
          numberOfPledges: ''
        }
      });

      await this.updateBlockchainData(this.state.currentAddress);
    } catch (error) {
      this.setState({ message: `Failed to create campaign: ${error.message}` });
    } finally {
      this.setState({ isCreatingCampaign: false });
    }
  };
  
  // Συνεισφορά σε μια καμπάνια
  pledgeToCampaign = async (campaignId) => {
    try {
      // Εύρεση της καμπάνιας
      const campaign = this.state.campaigns.active.find(c => c.id === campaignId);
  
      if (!campaign) {
        this.setState({ message: 'Campaign not found.' });
        return;
      }
  
      // Αγορά ενός μεριδίου
      const sharesToBuy = 1;
  
      // Υπολογισμός κόστους
      const totalCostWei = web3.utils.toWei(
        (sharesToBuy * parseFloat(campaign.shareCost)).toString(), 
        'ether'
      );
  
      // Κλήση του smart contract για αγορά μεριδίου
      await crowdfunding.methods.fundCampaign(Number(campaignId), sharesToBuy).send({
        from: this.state.currentAddress,
        value: totalCostWei,
      });
          
      this.setState({ message: 'Pledge successful!' });
      await this.updateBlockchainData(this.state.currentAddress);
      await this.loadUserShares();
    } catch (error) {
      console.error('Error pledging to campaign:', error);
      this.setState({ message: `Failed to pledge: ${error.message}` });
    }
  };

  // Ολοκλήρωση καμπάνιας
  fulfillCampaign = async (campaignId) => {
    try {
      await crowdfunding.methods.completeCampaign(campaignId).send({
        from: this.state.currentAddress,
      });
  
      this.setState({ message: 'Campaign fulfilled successfully!' });
      await this.updateBlockchainData(this.state.currentAddress);
    } catch (error) {
      console.error('Error fulfilling campaign:', error);
      this.setState({ message: `Failed to fulfill campaign: ${error.message}` });
    }
  };

  // Ακύρωση καμπάνιας
  cancelCampaign = async (campaignId) => {
    try {
      await crowdfunding.methods.cancelCampaign(Number(campaignId)).send({
        from: this.state.currentAddress
      });
  
      this.setState({ message: 'Campaign cancelled successfully!' });
      await this.updateBlockchainData(this.state.currentAddress);
    } catch (error) {
      console.error('Error cancelling campaign:', error);
      this.setState({ message: `Failed to cancel campaign: ${error.message}` });
    }
  };

  claimRefund = async () => {
    try {
      await crowdfunding.methods.refundBacker().send({
        from: this.state.currentAddress,
      });
  
      this.setState({ message: 'Refund claimed for all applicable campaigns!' });
  
      // Ενημέρωση δεδομένων blockchain
      await this.updateBlockchainData(this.state.currentAddress);
    } catch (error) {
      console.error('Error claiming refund:', error);
      this.setState({ message: `Failed to claim refund: ${error.message}` });
    }
  };

  withdrawFees = async () => {
    try {
      await crowdfunding.methods.ownerWithdrawal().send({
        from: this.state.currentAddress
      });

      this.setState({ message: 'Fees withdrawn successfully!' });
      await this.updateBlockchainData(this.state.currentAddress);
    } catch (error) {
      console.error('Error withdrawing fees:', error);
      this.setState({ message: `Failed to withdraw fees: ${error.message}` });
    }
  };

  changeOwner = async () => {
    try {
      const { newOwnerAddress } = this.state;
      
      if (!web3.utils.isAddress(newOwnerAddress)) {
        this.setState({ message: 'Invalid Ethereum address' });
        return;
      }

      await crowdfunding.methods.changeContractOwner(newOwnerAddress).send({
        from: this.state.currentAddress
      });

      this.setState({ 
        message: 'Ownership transferred successfully!',
        newOwnerAddress: '' // Clear the input field
      });
      await this.updateBlockchainData(this.state.currentAddress);
    } catch (error) {
      console.error('Error changing owner:', error);
      this.setState({ message: `Failed to change owner: ${error.message}` });
    }
  };

  banEntrepreneur = async () => {
    try {
      const { bannedAddress } = this.state;
      
      if (!web3.utils.isAddress(bannedAddress)) {
        this.setState({ message: 'Invalid Ethereum address' });
        return;
      }
  
      await crowdfunding.methods.addBannedAddress(bannedAddress).send({
        from: this.state.currentAddress
      });
  
      this.setState(prevState => ({
        message: 'Entrepreneur banned successfully!',
        bannedAddress: '',
        isBanned: bannedAddress === prevState.currentAddress
      }));
      await this.updateBlockchainData(this.state.currentAddress);
    } catch (error) {
      console.error('Error banning entrepreneur:', error);
      this.setState({ message: `Failed to ban entrepreneur: ${error.message}` });
    }
  };

  // Διεκδίκηση επιστροφής χρημάτων για ακυρωμένες καμπάνιες
  destroyContract = async () => {
    try {
      await crowdfunding.methods.destroyContract().send({
        from: this.state.currentAddress
      });

      this.setState({ 
        message: 'Contract destroyed successfully! All active campaigns have been cancelled.',
        isContractDestroyed: true
      });
      await this.updateBlockchainData(this.state.currentAddress);
    } catch (error) {
      console.error('Error destroying contract:', error);
      this.setState({ message: `Failed to destroy contract: ${error.message}` });
    }
  }; 
  
  // Η μέθοδος render() καθορίζει τι θα εμφανιστεί στην οθόνη
  render() {
    const isOwner = this.hasAdminRights();

    return (
      <div className="container mt-4">
        <h1>Crowdfunding DApp</h1>
        
        {/* Εμφάνιση βασικών πληροφοριών */}
        <div className="card mb-4">
          <div className="card-body">
            <p>Current Address: {this.state.currentAddress}</p>
            <p>Owner's Address: {this.state.ownerAddress}</p>
            <p>
              Balance: {this.state.balance} ETH | 
              Collected fees: {this.state.collectedFees} ETH
            </p>
          </div>
        </div>

        {/* New Campaign Form */}
        <div className="card mb-4">
          <div className="card-header">
            <h3>New campaign</h3>
          </div>
          <div className="card-body">
            <form onSubmit={this.createCampaign}>
              <div className="form-group">
                <label htmlFor="campaignTitle">Title (must be unique)</label>
                <input
                  id="campaignTitle"
                  type="text"
                  className="form-control"
                  value={this.state.newCampaign.title}
                  onChange={e => this.setState(prevState => ({
                    newCampaign: { ...prevState.newCampaign, title: e.target.value }
                  }))}
                  disabled={isOwner || this.state.isBanned || this.state.isContractDestroyed}
                />
              </div>
              <div className="form-group">
                <label htmlFor="pledgeCost">Share cost (ETH)</label>
                <input
                  id="pledgeCost"
                  type="number"
                  step="0.000000000000000001"
                  className="form-control"
                  value={this.state.newCampaign.pledgeCost}
                  onChange={e => this.setState(prevState => ({
                    newCampaign: { ...prevState.newCampaign, pledgeCost: e.target.value }
                  }))}
                  disabled={isOwner || this.state.isBanned || this.state.isContractDestroyed}
                />
              </div>
              <div className="form-group">
                <label htmlFor="numberOfPledges">Number of shares needed</label>
                <input
                  id="numberOfPledges"
                  type="number"
                  min="1"
                  className="form-control"
                  value={this.state.newCampaign.numberOfPledges}
                  onChange={e => this.setState(prevState => ({
                    newCampaign: { ...prevState.newCampaign, numberOfPledges: e.target.value }
                  }))}
                  disabled={isOwner || this.state.isBanned || this.state.isContractDestroyed}
                />
              </div>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={isOwner || this.state.isCreatingCampaign || this.state.isBanned}
              >
                {this.state.isCreatingCampaign ? 'Creating...' : 'Create'}
              </button>
              {isOwner && (
                <small className="text-muted ml-2">
                  Contract owner cannot create campaigns. 
                </small>
              )}
              {this.state.isBanned && (
                <small className="text-danger ml-2">
                  You are banned from creating campaigns. 
                </small>
              )}
              {this.state.isContractDestroyed && (
                <small className="text-danger ml-2">
                  The contract is destroyed. 
                </small>
              )}
            </form>
          </div>
        </div>

        {/* active Campaigns */}
        <h3>Active campaigns</h3>
        <CampaignList 
          campaigns={this.state.campaigns.active}
          onPledge={this.pledgeToCampaign}
          onCancel={this.cancelCampaign}
          onFulfill={this.fulfillCampaign}
          currentAddress={this.state.currentAddress}
          ownerAddress={this.state.ownerAddress}
          userShares={this.state.userShares}
          hasAdminRights={this.hasAdminRights()}
        />

        {/* Fulfilled Campaigns */}
        <h3>Fulfilled campaigns</h3>
        <CampaignList 
          campaigns={this.state.campaigns.fulfilled}
          userShares={this.state.userShares}
          readonly={true}
        />

        {/* Canceled Campaigns */}
        <h3>Canceled campaigns</h3>
        {this.state.campaigns.canceled.some(campaign => 
        this.state.userShares[campaign.id] && 
        parseInt(this.state.userShares[campaign.id]) > 0
        ) && (
          <button 
            className="btn btn-warning btn-sm mb-2"
            onClick={this.claimRefund}
          >  
            Claim Refund
          </button>
        )}
        <CampaignList 
          campaigns={this.state.campaigns.canceled}
          userShares={this.state.userShares}
          readonly={true}
        />

        {/* Control Panel */}
        {isOwner && (
          <div className="card mt-4">
            <div className="card-header">
              <h3>Control Panel</h3>
            </div>
            <div className="card-body">
              <div className="row mb-3">
                <div className="col">
                  <button 
                    className="btn btn-warning mr-2"
                    onClick={this.withdrawFees}
                    disabled={this.state.isContractDestroyed}
                  >
                    Withdraw
                  </button>
                  <small className="text-muted ml-2">
                    Transfer accumulated fees to owner's wallet
                  </small>
                </div>
              </div>

              <div className="row mb-3">
                <div className="col-md-8">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="New Owner Address"
                    value={this.state.newOwnerAddress}
                    onChange={e => this.setState({ newOwnerAddress: e.target.value })}
                    disabled={this.state.isContractDestroyed}
                  />
                </div>
                <div className="col-md-4">
                  <button 
                    className="btn btn-primary"
                    onClick={this.changeOwner}
                    disabled={this.state.isContractDestroyed}
                  >
                    Change Owner
                  </button>
                </div>
              </div>

              <div className="row mb-3">
                <div className="col-md-8">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Address to Ban"
                    value={this.state.bannedAddress}
                    onChange={e => this.setState({ bannedAddress: e.target.value })}
                    disabled={this.state.isContractDestroyed}
                  />
                </div>
                <div className="col-md-4">
                  <button 
                    className="btn btn-danger"
                    onClick={this.banEntrepreneur}
                    disabled={this.state.isContractDestroyed}
                  >
                    Ban Entrepreneur
                  </button>
                </div>
              </div>

              <div className="row">
                <div className="col">
                  <button 
                    className="btn btn-danger"
                    onClick={this.destroyContract}
                    disabled={this.state.isContractDestroyed}
                  >
                    Destroy Contract
                  </button>
                  <small className="text-muted ml-2">
                    {this.state.isContractDestroyed ? 
                      'Contract is destroyed. Only refunds for cancelled campaigns are possible.' : 
                      'This will cancel all active campaigns and disable new campaign creation'}
                  </small>
                </div>
              </div>
            </div>
          </div>
        )}

        {this.state.message && (
          <div className="alert alert-info mt-4">
            {this.state.message}
          </div>
        )}
      </div>
    );
  }
}

export default App;