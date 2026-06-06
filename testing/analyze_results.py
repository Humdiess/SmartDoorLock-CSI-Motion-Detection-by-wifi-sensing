#!/usr/bin/env python3
"""
Smart Door Lock - Test Results Analyzer
Analyzes collected test data and generates reports
"""

import csv
import json
import os
import sys
from datetime import datetime
from collections import defaultdict
import statistics

try:
    import matplotlib.pyplot as plt
    import matplotlib
    matplotlib.use('Agg')  # Non-interactive backend
    PLOTTING_ENABLED = True
except ImportError:
    PLOTTING_ENABLED = False
    print("⚠️  matplotlib not installed. Install with: pip install matplotlib")
    print("   Charts will be skipped.\n")


class TestAnalyzer:
    def __init__(self, csv_file):
        self.csv_file = csv_file
        self.data = []
        self.load_data()
    
    def load_data(self):
        """Load CSV data"""
        print(f"Loading data from {self.csv_file}...")
        
        with open(self.csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Convert types
                try:
                    if row['Variance']:
                        row['Variance'] = float(row['Variance'])
                    if row['Threshold']:
                        row['Threshold'] = float(row['Threshold'])
                    if row['RSSI']:
                        row['RSSI'] = int(row['RSSI'])
                    row['Motion_Detected'] = (row['Motion_Detected'].lower() == 'true')
                    self.data.append(row)
                except:
                    pass  # Skip malformed rows
        
        print(f"✓ Loaded {len(self.data)} data points\n")
    
    def general_stats(self):
        """Calculate general statistics"""
        print("="*60)
        print("  GENERAL STATISTICS")
        print("="*60)
        
        if not self.data:
            print("No data to analyze!")
            return
        
        variances = [d['Variance'] for d in self.data if d['Variance'] is not None]
        thresholds = [d['Threshold'] for d in self.data if d['Threshold'] is not None]
        rssi_values = [d['RSSI'] for d in self.data if d['RSSI'] is not None]
        motion_count = sum(1 for d in self.data if d['Motion_Detected'])
        
        print(f"Total data points: {len(self.data)}")
        print(f"Motion events detected: {motion_count}")
        print(f"Motion detection rate: {motion_count/len(self.data)*100:.1f}%")
        
        if variances:
            print(f"\nVariance Statistics:")
            print(f"  Min:    {min(variances):.4f}")
            print(f"  Max:    {max(variances):.4f}")
            print(f"  Mean:   {statistics.mean(variances):.4f}")
            print(f"  Median: {statistics.median(variances):.4f}")
            if len(variances) > 1:
                print(f"  StdDev: {statistics.stdev(variances):.4f}")
        
        if thresholds:
            print(f"\nThreshold Statistics:")
            print(f"  Min:    {min(thresholds):.4f}")
            print(f"  Max:    {max(thresholds):.4f}")
            print(f"  Mean:   {statistics.mean(thresholds):.4f}")
        
        if rssi_values:
            print(f"\nRSSI Statistics:")
            print(f"  Min:    {min(rssi_values)} dBm")
            print(f"  Max:    {max(rssi_values)} dBm")
            print(f"  Mean:   {statistics.mean(rssi_values):.1f} dBm")
        
        print("="*60 + "\n")
    
    def motion_events_analysis(self):
        """Analyze motion detection events"""
        print("="*60)
        print("  MOTION EVENTS ANALYSIS")
        print("="*60)
        
        motion_events = [d for d in self.data if d['Motion_Detected']]
        
        if not motion_events:
            print("No motion events detected!")
            return
        
        print(f"Total motion events: {len(motion_events)}")
        
        variances = [d['Variance'] for d in motion_events if d['Variance'] is not None]
        if variances:
            print(f"\nVariance during motion:")
            print(f"  Min:    {min(variances):.4f}")
            print(f"  Max:    {max(variances):.4f}")
            print(f"  Mean:   {statistics.mean(variances):.4f}")
            print(f"  Median: {statistics.median(variances):.4f}")
        
        # Time between events
        timestamps = [datetime.fromisoformat(d['Timestamp']) for d in motion_events]
        if len(timestamps) > 1:
            intervals = [(timestamps[i+1] - timestamps[i]).total_seconds() 
                        for i in range(len(timestamps)-1)]
            print(f"\nTime between motion events:")
            print(f"  Min:    {min(intervals):.1f} seconds")
            print(f"  Max:    {max(intervals):.1f} seconds")
            print(f"  Mean:   {statistics.mean(intervals):.1f} seconds")
        
        print("="*60 + "\n")
    
    def plot_timeline(self, output_file='timeline.png'):
        """Plot variance and motion over time"""
        if not PLOTTING_ENABLED:
            return
        
        print("Generating timeline plot...")
        
        timestamps = [datetime.fromisoformat(d['Timestamp']) for d in self.data]
        variances = [d['Variance'] if d['Variance'] is not None else 0 for d in self.data]
        thresholds = [d['Threshold'] if d['Threshold'] is not None else 0 for d in self.data]
        motions = [1 if d['Motion_Detected'] else 0 for d in self.data]
        
        # Convert to relative time (seconds from start)
        start_time = timestamps[0]
        time_seconds = [(t - start_time).total_seconds() for t in timestamps]
        
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8), sharex=True)
        
        # Plot variance and threshold
        ax1.plot(time_seconds, variances, label='Variance', color='blue', alpha=0.7)
        ax1.plot(time_seconds, thresholds, label='Threshold', color='red', linestyle='--', alpha=0.7)
        ax1.set_ylabel('Variance')
        ax1.set_title('Motion Detection - Variance Over Time')
        ax1.legend()
        ax1.grid(True, alpha=0.3)
        
        # Plot motion events
        ax2.fill_between(time_seconds, motions, alpha=0.5, color='red', label='Motion Detected')
        ax2.set_ylabel('Motion (0/1)')
        ax2.set_xlabel('Time (seconds)')
        ax2.set_ylim(-0.1, 1.1)
        ax2.set_title('Motion Events')
        ax2.legend()
        ax2.grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.savefig(output_file, dpi=150)
        print(f"✓ Saved timeline plot to {output_file}\n")
        plt.close()
    
    def plot_histogram(self, output_file='histogram.png'):
        """Plot variance histogram"""
        if not PLOTTING_ENABLED:
            return
        
        print("Generating histogram...")
        
        variances_all = [d['Variance'] for d in self.data if d['Variance'] is not None]
        variances_motion = [d['Variance'] for d in self.data if d['Motion_Detected'] and d['Variance'] is not None]
        variances_no_motion = [d['Variance'] for d in self.data if not d['Motion_Detected'] and d['Variance'] is not None]
        
        fig, ax = plt.subplots(figsize=(10, 6))
        
        bins = 30
        ax.hist(variances_no_motion, bins=bins, alpha=0.5, label='No Motion', color='blue')
        ax.hist(variances_motion, bins=bins, alpha=0.5, label='Motion Detected', color='red')
        
        ax.set_xlabel('Variance')
        ax.set_ylabel('Frequency')
        ax.set_title('Variance Distribution')
        ax.legend()
        ax.grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.savefig(output_file, dpi=150)
        print(f"✓ Saved histogram to {output_file}\n")
        plt.close()
    
    def export_summary(self, output_file='summary.json'):
        """Export summary to JSON"""
        print("Generating summary...")
        
        variances = [d['Variance'] for d in self.data if d['Variance'] is not None]
        motion_count = sum(1 for d in self.data if d['Motion_Detected'])
        
        summary = {
            'file': self.csv_file,
            'analysis_time': datetime.now().isoformat(),
            'total_data_points': len(self.data),
            'motion_events': motion_count,
            'motion_rate': motion_count / len(self.data) if self.data else 0,
            'variance': {
                'min': min(variances) if variances else None,
                'max': max(variances) if variances else None,
                'mean': statistics.mean(variances) if variances else None,
                'median': statistics.median(variances) if variances else None,
                'stdev': statistics.stdev(variances) if len(variances) > 1 else None
            }
        }
        
        with open(output_file, 'w') as f:
            json.dump(summary, f, indent=2)
        
        print(f"✓ Saved summary to {output_file}\n")


def main():
    if len(sys.argv) < 2:
        print("Usage: python analyze_results.py <csv_file>")
        print("\nAvailable test data files:")
        
        if os.path.exists('test_data'):
            files = [f for f in os.listdir('test_data') if f.endswith('.csv')]
            for i, f in enumerate(files, 1):
                print(f"  {i}. {f}")
            
            if files:
                choice = input("\nEnter file number or path: ").strip()
                try:
                    idx = int(choice) - 1
                    csv_file = os.path.join('test_data', files[idx])
                except:
                    csv_file = choice
            else:
                print("No test data files found!")
                sys.exit(1)
        else:
            print("test_data directory not found!")
            sys.exit(1)
    else:
        csv_file = sys.argv[1]
    
    if not os.path.exists(csv_file):
        print(f"Error: File not found: {csv_file}")
        sys.exit(1)
    
    # Create output directory
    output_dir = os.path.join(os.path.dirname(csv_file), 
                              os.path.basename(csv_file).replace('.csv', '_analysis'))
    os.makedirs(output_dir, exist_ok=True)
    
    print("\n" + "="*60)
    print("  TEST RESULTS ANALYZER")
    print("="*60 + "\n")
    
    analyzer = TestAnalyzer(csv_file)
    analyzer.general_stats()
    analyzer.motion_events_analysis()
    
    if PLOTTING_ENABLED:
        analyzer.plot_timeline(os.path.join(output_dir, 'timeline.png'))
        analyzer.plot_histogram(os.path.join(output_dir, 'histogram.png'))
    
    analyzer.export_summary(os.path.join(output_dir, 'summary.json'))
    
    print("="*60)
    print(f"  Analysis complete! Results saved to: {output_dir}")
    print("="*60 + "\n")


if __name__ == "__main__":
    main()
