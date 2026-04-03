module ttr_dharma::dharma_token {
    use sui::coin::{Self, TreasuryCap};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use std::option;
    use sui::url::{Self, Url};

    /// OTW (One Time Witness) for creating the Coin
    public struct DHARMA_TOKEN has drop {}

    /// Define a capability for the Admin (TTR backend) to be able to mint tokens.
    public struct AdminCap has key {
        id: sui::object::UID
    }

    /// Init function runs once when the contract is deployed.
    fun init(witness: DHARMA_TOKEN, ctx: &mut TxContext) {
        // Create the DHARMA coin with 0 decimals (since they are discrete points)
        let (treasury_cap, metadata) = coin::create_currency(
            witness, 
            0, // Decimals
            b"DHARMA", // Symbol
            b"Dharma Token", // Name
            b"The official intelligence-earned token of TTR-AI. Learn to earn.", // Description
            option::some(url::new_unsafe_from_bytes(b"https://www.ttrai.in/favicon.ico")), // Icon URL
            ctx
        );
        
        // Freeze the metadata so the name/symbol can never be changed
        transfer::public_freeze_object(metadata);
        
        // Send the TreasuryCap to the deployer (this will be the backend/admin wallet)
        transfer::public_transfer(treasury_cap, tx_context::sender(ctx));

        // Create and send the AdminCap to the deployer
        let admin_cap = AdminCap {
            id: sui::object::new(ctx)
        };
        transfer::transfer(admin_cap, tx_context::sender(ctx));
    }

    /// TTR-AI Backend calls this function to dynamically mint and award Dharma tokens to learners
    public entry fun reward_user(
        treasury_cap: &mut TreasuryCap<DHARMA_TOKEN>, 
        amount: u64, 
        recipient: address, 
        ctx: &mut TxContext
    ) {
        let coin = coin::mint(treasury_cap, amount, ctx);
        transfer::public_transfer(coin, recipient);
    }
}
