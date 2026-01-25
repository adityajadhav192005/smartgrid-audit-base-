"""Main Pipeline Orchestrator

Coordinates all stages of the smart grid audit framework pipeline.
"""

import logging
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime

from .config_manager import ConfigManager
from ..simulation.run_simulation import run_simulation_24h
from ..simulation.eval_suite import build_summary


class Pipeline:
    """Main pipeline orchestrator for smart grid audit framework"""
    
    def __init__(self, config_path: Optional[Path] = None):
        """Initialize pipeline with configuration
        
        Args:
            config_path: Optional path to configuration file
        """
        self.config_manager = ConfigManager(config_path)
        self.config_manager.validate()
        
        # Setup logging
        self.logger = logging.getLogger(__name__)
        self._setup_logging()
        
        self.results: Dict[str, Any] = {}
    
    def _setup_logging(self) -> None:
        """Configure logging"""
        log_dir = self.config_manager.config.evaluation.output_dir
        log_dir.mkdir(parents=True, exist_ok=True)
        
        log_file = log_dir / f"pipeline_{datetime.now():%Y%m%d_%H%M%S}.log"
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s | %(levelname)s | %(name)s | %(message)s',
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler()
            ]
        )
    
    def run(self, modes: Optional[list] = None) -> Dict[str, Any]:
        """Run the complete pipeline
        
        Args:
            modes: List of modes to run ['dynamic', 'baseline']. If None, runs both.
        
        Returns:
            Dictionary with results from all stages
        """
        if modes is None:
            modes = ['dynamic', 'baseline']
        
        self.logger.info("=" * 70)
        self.logger.info("SMART GRID AUDIT FRAMEWORK - PIPELINE EXECUTION")
        self.logger.info("=" * 70)
        self.logger.info(f"Configuration: {self.config_manager}")
        self.logger.info(f"Output directory: {self.config_manager.config.evaluation.output_dir}")
        
        start_time = datetime.now()
        
        # Stage 1: Run Dynamic Simulation
        if 'dynamic' in modes:
            self.logger.info("\n[Stage 1/4] Running DYNAMIC simulation with RL audit scheduling...")
            dynamic_results = self._run_dynamic_simulation()
            self.results['dynamic'] = dynamic_results
        
        # Stage 2: Run Baseline Simulation  
        if 'baseline' in modes:
            self.logger.info("\n[Stage 2/4] Running BASELINE simulation...")
            baseline_results = self._run_baseline_simulation()
            self.results['baseline'] = baseline_results
        
        # Stage 3: Evaluate and Compare
        self.logger.info("\n[Stage 3/4] Computing evaluation metrics...")
        evaluation = self._evaluate_results()
        self.results['evaluation'] = evaluation
        
        # Stage 4: Generate Reports
        self.logger.info("\n[Stage 4/4] Generating reports...")
        self._generate_reports()
        
        elapsed = (datetime.now() - start_time).total_seconds()
        self.logger.info(f"\nPipeline completed successfully in {elapsed:.1f} seconds")
        
        return self.results
    
    def _run_dynamic_simulation(self) -> Dict[str, Any]:
        """Run dynamic simulation with RL-based audit scheduling"""
        params = self.config_manager.get_simulation_params()
        
        results = run_simulation_24h(
            N=params['N'],
            T=params['T'],
            attack_rate=params['attack_rate'],
            seed=params['seed'],
            mode='dynamic',
            max_audits_per_cycle=self.config_manager.config.audit.max_audits_per_cycle,
            C_f=self.config_manager.config.audit.failure_cost_coefficient,
        )
        
        self.logger.info(f"  ✓ Completed {params['T']} timesteps")
        self.logger.info(f"  ✓ Converged: {results.get('converged', False)}")
        self.logger.info(f"  ✓ RL iterations: {results.get('rl_iterations', 0)}")
        
        return results
    
    def _run_baseline_simulation(self) -> Dict[str, Any]:
        """Run baseline simulation without RL optimization"""
        params = self.config_manager.get_simulation_params()
        
        results = run_simulation_24h(
            N=params['N'],
            T=params['T'],
            attack_rate=params['attack_rate'],
            seed=params['seed'] + 1000,  # Different seed for baseline
            mode='baseline',
            max_audits_per_cycle=self.config_manager.config.audit.max_audits_per_cycle,
            C_f=self.config_manager.config.audit.failure_cost_coefficient,
        )
        
        self.logger.info(f"  ✓ Completed {params['T']} timesteps")
        
        return results
    
    def _evaluate_results(self) -> Dict[str, Any]:
        """Compute evaluation metrics comparing dynamic vs baseline"""
        if 'dynamic' not in self.results or 'baseline' not in self.results:
            raise ValueError("Both dynamic and baseline results required for evaluation")
        
        dyn = self.results['dynamic']
        base = self.results['baseline']
        
        summary = build_summary(
            dynamic_records=dyn['metrics'],
            baseline_records=base['metrics'],
            y_true_dyn=dyn.get('y_true', None),
            y_pred_dyn=dyn.get('y_pred', None),
            y_pred_types_dyn=dyn.get('y_pred_types_dyn', None),
            y_true_types_dyn=dyn.get('y_true_types_dyn', None),
            initial_risk=dyn.get('initial_risk', 0.0),
            final_risk=dyn.get('final_risk', 0.0),
            failure_cost_coeff=self.config_manager.config.audit.failure_cost_coefficient,
        )
        
        # Log key metrics
        self.logger.info(f"  ✓ Attack Rate Reduction: {summary['attack_rate_reduction']:.2%}")
        self.logger.info(f"  ✓ Cost Efficiency: {summary['cost_efficiency']:.2%}")
        self.logger.info(f"  ✓ Risk Mitigation: {summary['risk_mitigation']:.2%}")
        self.logger.info(f"  ✓ F1-Score: {summary.get('f1', 0):.3f}")
        
        return summary
    
    def _generate_reports(self) -> None:
        """Generate output reports and visualizations"""
        output_dir = self.config_manager.config.evaluation.output_dir
        
        # Save summary to JSON
        if self.config_manager.config.evaluation.save_json:
            import json
            summary_path = output_dir / "summary.json"
            with open(summary_path, 'w') as f:
                json.dump(self.results['evaluation'], f, indent=2, default=str)
            self.logger.info(f"  ✓ Saved summary: {summary_path}")
        
        # Save CSV files
        if self.config_manager.config.evaluation.save_csv:
            import pandas as pd
            
            if 'dynamic' in self.results:
                dyn_df = pd.DataFrame(self.results['dynamic']['metrics'])
                dyn_df.to_csv(output_dir / "dynamic_metrics.csv", index=False)
                
                dyn_events = pd.DataFrame(self.results['dynamic']['events'])
                dyn_events.to_csv(output_dir / "events_dynamic.csv", index=False)
            
            if 'baseline' in self.results:
                base_df = pd.DataFrame(self.results['baseline']['metrics'])
                base_df.to_csv(output_dir / "baseline_metrics.csv", index=False)
                
                base_events = pd.DataFrame(self.results['baseline']['events'])
                base_events.to_csv(output_dir / "events_baseline.csv", index=False)
            
            self.logger.info(f"  ✓ Saved CSV files: {output_dir}")
        
        self.logger.info(f"\nOutputs saved to: {output_dir.absolute()}")


if __name__ == "__main__":
    # Example usage
    pipeline = Pipeline()
    results = pipeline.run()
