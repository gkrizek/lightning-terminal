import { makeAutoObservable, runInAction } from 'mobx';
import Big from 'big.js';
import { prefixTranslation } from 'util/translate';
import { Store } from 'store';

const { l } = prefixTranslation('views.fundNewAccountView');

export default class FundNewAccountView {
  private _store: Store;

  // editable form fields
  amount = 0;
  confTarget = 0;
  expireBlocks = 0;
  // response from quote
  minerFee = 0;

  constructor(store: Store) {
    makeAutoObservable(this, {}, { deep: false, autoBind: true });

    this._store = store;
  }

  //
  // Computed properties
  //

  get hasActiveAccount() {
    return !!this._store.accountStore.activeTraderKey;
  }

  get walletBalance() {
    return this._store.nodeStore.wallet.walletBalance;
  }

  get accountBalance() {
    return this.hasActiveAccount
      ? this._store.accountStore.activeAccount.availableBalance
      : Big(0);
  }

  get newBalance() {
    return this.accountBalance.plus(this.amount);
  }

  /** the error message if the amount is invalid */
  get amountError() {
    if (!this.amount) return '';
    const accountMinimum = 100000;
    if (this.amount < accountMinimum) {
      return l('amountTooLow', { accountMinimum });
    }
    if (this.walletBalance.lt(this.amount)) {
      return l('amountTooHigh');
    }
    return '';
  }

  /** the error message if the expireBlocks is invalid */
  get expireBlocksError() {
    if (!this.expireBlocks) return '';
    const blocksPerDay = 144;
    if (this.expireBlocks < blocksPerDay) {
      return l('lowExpireBlocks', { blocks: blocksPerDay });
    }
    if (this.expireBlocks > blocksPerDay * 365) {
      return l('highExpireBlocks', { blocks: blocksPerDay * 365 });
    }
    return '';
  }

  /** the error message if the confTarget is invalid */
  get confTargetError() {
    if (!this.confTarget) return '';
    if (this.confTarget <= 1) {
      return l('lowConfTarget');
    }
    return '';
  }

  /** determines if the current values are all valid */
  get isValid() {
    return (
      ![this.amount, this.confTarget, this.expireBlocks].includes(0) && !this.amountError
    );
  }

  //
  // Form field setters
  //

  setAmount(amount: number) {
    this.amount = amount;
  }

  setConfTarget(confTarget: number) {
    this.confTarget = confTarget;
  }

  setExpireBlocks(expireBlocks: number) {
    this.expireBlocks = expireBlocks;
  }

  //
  // Actions
  //

  /** sets the amount to the maximum available in the wallet */
  setMaxAmount() {
    this.amount = +this.walletBalance;
  }

  /** shows the summary view */
  cancel() {
    this.amount = 0;
    this.confTarget = 0;
    this.expireBlocks = 0;
    this._store.accountSectionView.showSummary();
  }

  /** shows the confirmation view */
  async confirm() {
    try {
      // query for the miner fee before showing the confirm view
      const { minerFeeTotal } = await this._store.api.pool.quoteAccount(
        this.amount,
        this.confTarget,
      );

      runInAction(() => {
        this.minerFee = minerFeeTotal;
      });

      this._store.accountSectionView.showFundNewConfirm();
    } catch (error) {
      this._store.appView.handleError(error, 'Unable to estimate miner fee');
    }
  }

  /** submits the order to the API and resets the form values if successful */
  async fundAccount() {
    // if there is an error, it will be displayed by createAccount
    const traderKey = await this._store.accountStore.createAccount(
      this.amount,
      this.expireBlocks,
      this.confTarget,
    );

    if (traderKey) {
      this.cancel();
    }
  }
}
