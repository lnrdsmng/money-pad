<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\WithdrawalService;
use Illuminate\Console\Command;

class ReconcileEligibleWithdrawals extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'withdrawals:reconcile';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Evaluate and trigger automatic payouts for users who meet the threshold but missed real-time triggers';

    /**
     * Execute the console command.
     */
    public function handle(WithdrawalService $service): int
    {
        $this->info('Starting withdrawal reconciliation...');

        $minCoins = 1000; // 1000 coins = ₱10.00 (GCash min)
        $users = User::query()
            ->where('readerCoins', '>=', $minCoins)
            ->whereNotNull('payment_method')
            ->whereNotNull('payment_account_info')
            ->get();

        $triggeredCount = 0;
        foreach ($users as $user) {
            $created = $service->evaluateAndCreate($user);
            if ($created) {
                $triggeredCount++;
                $this->line("Triggered withdrawal for user {$user->id} ({$user->username}) - ₱{$created->amount}");
            }
        }

        $this->info("Reconciliation complete. {$triggeredCount} withdrawals created.");

        return Command::SUCCESS;
    }
}
