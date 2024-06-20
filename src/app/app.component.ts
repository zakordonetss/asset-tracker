import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HighchartsChartModule } from 'highcharts-angular';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HighchartsChartModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.sass',
})
export class AppComponent {}
