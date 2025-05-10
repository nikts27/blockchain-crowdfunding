// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

contract Crowdfunding {
    address payable public owner; // Ιδιοκτήτης του συμβολαίου
    uint public constant CAMPAIGN_FEE = 0.02 ether; // Κόστος δημιουργίας καμπάνιας 

    uint public ownerFunds; // Έσοδα του ιδιοκτήτη του συμβολαίου
    bool public contractDestroyed; // Μεταβλητή flag που δείχνει αν το συμβόλαιο καταστράφηκε

    struct Campaign {
        uint campaignId;
        address payable entrepreneur;
        string title;
        uint shareCost;
        uint sharesNeeded;
        uint sharesCount;
        bool fulfilled;
        bool cancelled;
        address[] backers;
        uint backerCount;
        mapping(address => uint) investments; // mapping που δείχνει πόσες μετοχές κατέχει ο κάθε επενδυτής
    }

    uint public campaignCount; // Αριθμός καμπανιών που δημιουργούνται

    mapping(uint => Campaign) public campaigns; // Λίστα καμπανιών
    address[] public bannedAddresses; // Λίστα αποκλεισμένων

    // 6. Συμβάντα που πυροδοτούνται
    event CampaignCreated(
        address _enterpreneur,
        uint campaignId,
        string title,
        uint shareCost,
        uint sharesNeeded
    );

    event CampaignFunded(
        uint campaignId,
        string campaignTitle,
        address _backer,
        uint sharesBought
    );

    event CampaignCancelled(
        uint campaignId,
        string campaignTitle,
        address _enterpreneur
    );

    event BackerRefunded(
        address _backer,
        uint campaignId,
        string campaignTitle,
        uint totalRefund
    );

    event CampaignFulfilled(
        uint campaignId,
        string campaignTitle,
        address _enterpreneur,
        uint enterpreneurEarnings
    );

    event feesWithdrawn(
        address _owner,
        uint funds
    );

    event ownerChanged(
        address _newOwner
    );

    event addressBanned(
        address _bannedAddress
    );

    event destroyedContract(
        bool destroyed
    );

    constructor() {
        owner = msg.sender;
        ownerFunds = 0;
        campaignCount = 0;
        contractDestroyed = false;
    }

    // 1. Απαραίτητοι modifiers για έλεγχο κλήσης συναρτήσεων
    modifier notBanned() {
        bool banned = false;
        for (uint i=0; i<bannedAddresses.length; i++){
            if (msg.sender == bannedAddresses[i]){
                banned = true;
                break;
            }
        }

        require(!banned, "Banned from creating campaigns");
        _;
    }

    modifier notOwner() {
        require(msg.sender != owner, "Owner is not allowed to create campaigns");
        _;
    }

    modifier onlyEnterpreneurOrOwner(uint campaignId) {
        Campaign storage campaign = campaigns[campaignId-1];
        require(msg.sender == campaign.entrepreneur || msg.sender == owner, 
        "Only the campaign's enterpreneur and contract owner can perform this action");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner of the contract is allowed to perform this action");
        _;
    }

    modifier campaignActive(uint campaignId) {
        Campaign storage campaign = campaigns[campaignId-1];
        require(!campaign.fulfilled, "Campaign is fulfilled");
        require(!campaign.cancelled, "Campaign is cancelled");
        _;
    }

    modifier sharesReached(uint campaignId) {
        Campaign storage campaign = campaigns[campaignId-1];
        require(campaign.sharesCount >= campaign.sharesNeeded, "The needed amount of shares has not be reached");
        _;
    }

    modifier notDestroyed() {
        require(!contractDestroyed, "Contract is destroyed");
        _;
    }

    // 1. Συναρτήσεις για κάθε μια από τις κεντρικές ενέργειες του συμβολαίου που
    // αφορούν κυρίως τον επιχειρηματία
    // Δημιουργία καμπάνιας
    function createCampaign(string memory title, uint shareCost, uint sharesNeeded) 
    public payable notDestroyed notBanned notOwner {
        // Έλεγχοι εγκυρότητας δεδομένων
        require(msg.value == CAMPAIGN_FEE, "Incorrect campaign fee");
        require(bytes(title).length > 0, "Title cannot be empty");
        require(shareCost > 0, "share cost must be greater than zero");
        require(sharesNeeded > 0, "shares needed must be greater than zero");

        // Δημιουργία και αποθήκευση νέας καμπάνιας
        Campaign storage newCampaign = campaigns[campaignCount];
        campaignCount++;
        newCampaign.campaignId = campaignCount;
        newCampaign.entrepreneur = payable(msg.sender);
        newCampaign.title = title;
        newCampaign.shareCost = shareCost;
        newCampaign.sharesNeeded = sharesNeeded;
        newCampaign.sharesCount = 0;
        newCampaign.backerCount = 0;
        newCampaign.fulfilled = false;
        newCampaign.cancelled = false;

        // Πυροδότηση συμβάντος
        emit CampaignCreated(msg.sender, newCampaign.campaignId, title, shareCost, sharesNeeded);
    }

    // Ακύρωση καμπάνιας
    function cancelCampaign(uint campaignId) 
    public notDestroyed onlyEnterpreneurOrOwner(campaignId) campaignActive(campaignId) {
        // Έλεγχοι εγκυρότητας δεδομένων
        require(campaignId<=campaignCount, "Not existing campaign");

        Campaign storage campaign = campaigns[campaignId-1];

        // Σήμανση καμπάνιας ως ακυρωμένη
        campaign.cancelled = true;

        // Επιστροφή του τέλους καμπάνιας στον επιχειρηματία
        payable(campaign.entrepreneur).transfer(CAMPAIGN_FEE);

        // Πυροδότηση συμβάντος
        emit CampaignCancelled(campaignId, campaigns[campaignId].title, msg.sender);
    }

    // Ολοκλήρωση καμπάνιας
    function completeCampaign(uint campaignId) public 
    notDestroyed onlyEnterpreneurOrOwner(campaignId) campaignActive(campaignId) sharesReached(campaignId) {
        // Έλεγχοι εγκυρότητας δεδομένων
        require(campaignId<=campaignCount, "Not existing campaign");

        Campaign storage campaign = campaigns[campaignId-1];

        // Υπολογισμός συνολικών κερδών και ποσοστού επιχειρηματία
        uint totalFunds = campaign.sharesCount*campaign.shareCost;
        uint enterpreneurFunds = (totalFunds * 80) / 100;

        // Μεταφορά του 80% στον επιχειρηματία
        payable(campaign.entrepreneur).transfer(enterpreneurFunds);

        //Κράτηση του υπόλοιπου στον ιδιοκτήτη του συμβολαίου (+0,02 αντιτιμο)
        ownerFunds += (totalFunds - enterpreneurFunds) + CAMPAIGN_FEE;

        // Σήμανση καμπάνιας ως ολοκληρωμένη
        campaign.fulfilled = true;

        // Πυροδότηση συμβάντος
        emit CampaignFulfilled(campaignId, campaign.title, campaign.entrepreneur, ((totalFunds * 80) / 100));
    }

    // 3. συναρτήσεις για κάθε μια από τις διαχειριστικές ενέργειες του συμβολαίου
    // που αφορούν κυρίως τον επενδυτή.
    // Χρηματοδότηση καμπάνιας
    function fundCampaign(uint campaignId, uint sharesToBuy) public payable notDestroyed campaignActive(campaignId) {
        // Έλεγχοι εγκυρότητας δεδομένων
        require(campaignId<=campaignCount, "Not existing campaign");
        require(sharesToBuy > 0, "Shares amount must be greater than zero");

        Campaign storage campaign = campaigns[campaignId-1];

        // Υπολογισμός του απαιτούμενου ποσού για τις μετοχές
        uint totalCost = sharesToBuy * campaign.shareCost;
        require(msg.value == totalCost, "Incorrect Ether amount sent");

        // Προσθήκη του επενδυτή στον πίνακα επενδυτών αν δεν υπάρχει ήδη
        if (campaign.investments[msg.sender] == 0) {
           campaign.backers.push(msg.sender);
        }

        // Ενημέρωση των επενδύσεων
        campaign.investments[msg.sender] += sharesToBuy;
        campaign.sharesCount += sharesToBuy;

        // Πυροδότηση συμβάντος
        emit CampaignFunded(campaignId, campaign.title, msg.sender, sharesToBuy);
    }

    // Αποζημίωση επενδυτή
    function refundBacker() public {
        // Αναζήτηση ακυρωμένων εκστρατειών
        for (uint i=0; i<campaignCount; i++){
            Campaign storage campaign = campaigns[i];

            if (campaign.cancelled) { 
                uint amount = campaign.investments[msg.sender];
                if (amount > 0) {
                    campaign.investments[msg.sender] = 0;
                    uint refund = amount * campaign.shareCost;
                    payable(msg.sender).transfer(refund);

                    // Πυροδότηση συμβάντος
                    emit BackerRefunded(msg.sender, campaign.campaignId, campaign.title, refund);
                }

            } 
        }
    }

    // 4. Συναρτήσεις για κάθε μια από τις διαχειριστικές ενέργειες του συμβολαίου
    // που αφορούν κυρίως τον ιδιοκτήτη
    // Ανάληψη χρημάτων ιδιοκτήτη
    function ownerWithdrawal() public onlyOwner {
        payable(owner).transfer(ownerFunds);
        emit feesWithdrawn(owner, ownerFunds);
        ownerFunds = 0;
    }

    // Προσθήκη κακόβολου επιχειρηματία
    function addBannedAddress(address maliciousBacker) public notDestroyed onlyOwner {
        bannedAddresses.push(maliciousBacker);

        // Ακύρωση όλων των καμπανιών που δημιούργησε ο maliciousBacker
        for (uint i = 0; i < campaignCount; i++) {
            Campaign storage campaign = campaigns[i];

            if (campaign.entrepreneur == maliciousBacker && !campaign.fulfilled && !campaign.cancelled) {
                cancelCampaign(campaign.campaignId);
            }
        }

        emit addressBanned(maliciousBacker);
    }
    
    // Αλλαγή ιδιοκτήτη
    function changeContractOwner(address payable newOwner) public notDestroyed onlyOwner {
        owner = newOwner;
        emit ownerChanged(newOwner);
    }
    
    // Καταστροφή του συμβολαίου (ακύρωση όλων των ενεργών καμπανιών και 
    // επιστροφή του αντίστοιχου τέλους καμπάνιας στον δημιουργό της)
    function destroyContract() public onlyOwner {
        for (uint i=0; i<campaignCount; i++) {
            Campaign storage campaign = campaigns[i];

            if (!campaign.fulfilled && !campaign.cancelled) {
                cancelCampaign(campaign.campaignId);
            }
        }
       
        contractDestroyed = true;

        emit destroyedContract(contractDestroyed);
    }

    // 5. Βοηθητικές συναρτήσεις
    // Συνάρτηση που δέχεται ένα id μιας καμπάνιας και επιστρέφει τα στοιχεία της
    function getCampaignInfo(uint campaignId) public view returns(
        uint, address, string memory, uint, uint, uint, bool, bool
    ) {
        // Έλεγχοι εγκυρότητας δεδομένων
        require(campaignId<=campaignCount, "Not existing campaign");

        Campaign storage campaign = campaigns[campaignId-1];
       
        return (
            campaign.campaignId,
            campaign.entrepreneur,
            campaign.title,
            campaign.shareCost,
            campaign.sharesNeeded,
            campaign.sharesCount,
            campaign.fulfilled,
            campaign.cancelled
        );
    }

    // Συνάρτηση που επιστρέφει στον χρήστη τα id των ενεργών εκστρατειών
    // Ο χρήστης μετά μπορεί να καλεί την getCampaignInfo δίνοντας το αντίστοιχο id
    // για να βλέπει τα στοιχεία καθέ καμπάνιας.
    function getActiveCampaigns() public view returns (uint[] memory) {
        uint[] memory activeCampaigns = new uint[](campaignCount);
        uint index = 0;

        for (uint i=0; i<campaignCount; i++) {
            if (!campaigns[i].fulfilled && !campaigns[i].cancelled) {
                activeCampaigns[index] = campaigns[i].campaignId;
                index++;
            }
        }

        return activeCampaigns;
    }

    // Συνάρτηση που επιστρέφει στον χρήστη τα id των ολοκληρωμένων εκστρατειών
    // Ο χρήστης μετά μπορεί να καλεί την getCampaignInfo δίνοντας το αντίστοιχο id
    // για να βλέπει τα στοιχεία καθέ καμπάνιας.
    function getFulfiledCampaigns() public view returns (uint[] memory) {
        uint[] memory fulfilledCampaigns = new uint[](campaignCount);
        uint index = 0;

        for (uint i=0; i<campaignCount; i++) {
            if (campaigns[i].fulfilled) {
                fulfilledCampaigns[index] = campaigns[i].campaignId;
                index++;
            }
        }

        return fulfilledCampaigns;
    }

    // Επιστρέφει τις κρατήσεις που έχει το συμβόλαιο
    function getContractEther() public view returns (uint _funds){
        _funds = ownerFunds;
    }

    // Συνάρτηση που επιστρέφει στον χρήστη τα id των ολοκληρωμένων εκστρατειών
    // Ο χρήστης μετά μπορεί να καλεί την getCampaignInfo δίνοντας το αντίστοιχο id
    // για να βλέπει τα στοιχεία καθέ καμπάνιας.
    function getCancelledCampaigns() public view returns (uint[] memory) {
        uint[] memory cancelledCampaigns = new uint[](campaignCount);
        uint index = 0;

        for (uint i=0; i<campaignCount; i++) {
            if (campaigns[i].cancelled) {
                cancelledCampaigns[index] = campaigns[i].campaignId;
                index++;
            }
        }

        return cancelledCampaigns;
    }

    // Επιστρέφει τους απαγορευμένους χρήστες
    function getBannedBackers() public view returns (address[] memory _bannedBackers){
        _bannedBackers = bannedAddresses;
    }

    function getEnterpreneurCampaigns() public view returns (uint[] memory){
        uint[] memory campaignIds = new uint[](campaignCount);
        uint index = 0;

        for (uint i=0; i<campaignCount; i++) {
            Campaign storage campaign = campaigns[i];

            if (campaign.entrepreneur == msg.sender){
                campaignIds[index] = campaign.campaignId;
                index++;
            }
        }

        return campaignIds;
    }

    // Επιστρέφει τους επενδυτές μιας συγκεκριμένης καμπάνιας και τις μετοχές του καθένα
    function getCampaignBackers(uint campaignId) public view 
    returns (address[] memory, uint[] memory) {
        // Έλεγχοι εγκυρότητας δεδομένων
        require(campaignId<=campaignCount, "Not existing campaign");
        
        Campaign storage campaign = campaigns[campaignId-1];
        address[] memory backers = new address[](campaign.backers.length);
        uint[] memory investments = new uint[](campaign.backers.length);

        backers = campaign.backers;
        for (uint i=0; i<campaign.backers.length; i++){
            address backer = campaign.backers[i];
            investments[i] = campaign.investments[backer];   
        }

        return (backers, investments);
    }

    // Επιστρέφει τον αριθμό μετοχών που κατέχει ένας επενδυτής
    function getBackerShares(address backer) public view 
    returns (uint[] memory, uint[] memory) {
        uint[] memory backerCampaigns = new uint[](campaignCount);
        uint[] memory investments = new uint[](campaignCount);
        uint index = 0;

        for (uint i=0; i<campaignCount; i++){
            Campaign storage campaign = campaigns[i];

            for (uint j=0; j<campaign.backers.length; j++){
                if (campaign.backers[j] == backer) {
                    backerCampaigns[index] = campaign.campaignId;
                    investments[index] = campaign.investments[backer];
                    index++;
                    break;
                }
            }
        }

        return (backerCampaigns, investments);
    }
}