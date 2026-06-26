import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PatrolMapComponent } from './patrol-map/patrol-map.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, PatrolMapComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'Sistema de Patrullaje Inteligente';
}
