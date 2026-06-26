import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, HostListener, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../../environments/environment';

declare var google: any;

interface Patrol {
  id: string;
  marker: any;
  targetPoint?: any;
  targetMarker?: any;
  routeLine?: any;
  state: string;
  statusColor: string;
}

interface Delito {
  id: number;
  tipo_delito: string;
  coordenada: any;
  fecha_hora: string;
}

@Component({
  selector: 'app-patrol-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './patrol-map.component.html',
  styleUrls: ['./patrol-map.component.css']
})
export class PatrolMapComponent implements OnInit, AfterViewInit {
  @ViewChild('mapContainer', { static: false }) gmap!: ElementRef;
  
  map: any;
  heatmap: any;
  
  patrols: Patrol[] = [];
  selectedPatrolId: string | null = null;
  
  delitos: Delito[] = [];
  errorMessage: string = '';

  // Centro de Viña del Mar
  center = { lat: -33.0245, lng: -71.5518 };

  constructor(private ngZone: NgZone) {}

  ngOnInit(): void {
    this.fetchDelitos();
  }

  ngAfterViewInit(): void {
    this.loadGoogleMapsApi().then(() => {
      this.initMap();
    }).catch(err => {
      console.error('Error al cargar Google Maps API', err);
    });
  }

  async fetchDelitos() {
    try {
      const response = await fetch('http://localhost:3000/api/delitos');
      if (response.ok) {
        const data = await response.json();
        // Filtrar datos para quitar los puntos que cayeron en el mar por culpa de la aletoriedad del mock
        // (Aproximación de la línea costera de Viña del Mar)
        this.delitos = data.filter((d: any) => {
          if (d.coordenada && d.coordenada.coordinates) {
            const lng = d.coordenada.coordinates[0];
            const lat = d.coordenada.coordinates[1];
            // La costa de Viña va aprox por -71.552 en esa latitud
            if (lng < -71.552) return false; 
            return true;
          }
          return false;
        });

        if (this.map && this.heatmap) {
          this.updateHeatmapWithRealData();
        }
      }
    } catch (error) {
      console.error("No se pudo conectar al backend", error);
    }
  }

  loadGoogleMapsApi(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof google !== 'undefined' && google.maps) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.googleMapsApiKey}&libraries=visualization,geometry&v=3.64`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject('Fallo al cargar Google Maps API');
      document.body.appendChild(script);
    });
  }

  initMap() {
    try {
      this.map = new google.maps.Map(this.gmap.nativeElement, {
        center: this.center,
        zoom: 14,
        mapTypeId: 'roadmap',
        // Tema claro sin styles, usa el mapa de Google por defecto
      });

      this.initHeatmap();

      // Listener para definir el punto de destino de la patrulla
      this.map.addListener('click', (e: any) => {
        this.ngZone.run(() => {
          this.setTargetPoint(e.latLng);
        });
      });

      // Listener para quitar el destino con click derecho
      this.map.addListener('rightclick', (e: any) => {
        this.ngZone.run(() => {
          this.removeTargetPoint();
        });
      });

      // Listener para mantener el tamaño geográfico del mapa de calor al hacer zoom
      this.map.addListener('zoom_changed', () => {
        if (this.heatmap) {
          const zoom = this.map.getZoom();
          // A zoom 14, 35px hace que la mancha visual llene mejor el objetivo de 200m
          let newRadius = Math.round(35 * Math.pow(2, zoom - 14));
          if (newRadius < 5) newRadius = 5; 
          
          this.heatmap.setOptions({ radius: newRadius });
        }
      });

    } catch(err: any) {
      this.errorMessage = "Error en initMap: " + err.message;
    }
  }

  initHeatmap() {
    try {
      const gradient = [
        "rgba(0, 255, 0, 0)",      
        "rgba(150, 255, 0, 0.4)",  
        "rgba(255, 255, 0, 0.7)",  
        "rgba(255, 128, 0, 0.9)",  
        "rgba(255, 0, 0, 1)"       
      ];

      const initialZoom = this.map.getZoom() || 14;
      const initialRadius = Math.round(35 * Math.pow(2, initialZoom - 14));

      this.heatmap = new google.maps.visualization.HeatmapLayer({
        data: [],
        map: this.map,
        radius: initialRadius, // Radio inicial aumentado para que la mancha se vea más grande
        opacity: 0.8,
        gradient: gradient
      });

      if (this.delitos.length > 0) {
        this.updateHeatmapWithRealData();
      }
    } catch(err: any) {
      this.errorMessage = "Error en initHeatmap: " + err.message;
    }
  }

  updateHeatmapWithRealData() {
    try {
      const heatMapData: any[] = [];
      
      this.delitos.forEach(d => {
        if (d.coordenada && d.coordenada.coordinates) {
          const lng = d.coordenada.coordinates[0];
          const lat = d.coordenada.coordinates[1];
          
          heatMapData.push({
            location: new google.maps.LatLng(lat, lng),
            weight: 10 
          });
        }
      });

      this.heatmap.setData(heatMapData);
    } catch(err: any) {
      this.errorMessage = "Error en updateHeatmap: " + err.message;
    }
  }

  setTargetPoint(latLng: any) {
    const patrol = this.selectedPatrol;
    if (!patrol) {
      return; 
    }

    // Bloquear reasignación si ya tiene un destino activo
    if (patrol.targetPoint) {
      this.errorMessage = "❌ Comando Denegado: Patrulla con misión activa. Por favor, anule el destino actual (Click Derecho en el mapa) antes de asignar uno nuevo.";
      setTimeout(() => this.errorMessage = '', 6000);
      return;
    }

    // Validar que el punto seleccionado esté cerca de un punto de calor (delitos)
    let isNearCrime = false;
    const maxDistanceToHeat = 200; // Tolerancia estricta igual al radio del mapa de calor (200m)

    for (const d of this.delitos) {
      if (d.coordenada && d.coordenada.coordinates) {
        const crimePos = new google.maps.LatLng(
          d.coordenada.coordinates[1], 
          d.coordenada.coordinates[0]
        );
        const dist = google.maps.geometry.spherical.computeDistanceBetween(latLng, crimePos);
        if (dist <= maxDistanceToHeat) {
          isNearCrime = true;
          break;
        }
      }
    }

    if (!isNearCrime) {
      this.errorMessage = "❌ Comando Denegado: La patrulla solo puede ser enviada a zonas con riesgo activo (cerca de focos delictuales).";
      setTimeout(() => this.errorMessage = '', 6000);
      return;
    }
    
    // Si la validación pasa, limpiamos mensajes de error previos
    this.errorMessage = '';
    patrol.targetPoint = latLng;

    if (!patrol.targetMarker) {
      // Crear círculo de destino (200 metros de radio)
      patrol.targetMarker = new google.maps.Circle({
        strokeColor: '#f44336',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#f44336',
        fillOpacity: 0.2,
        map: this.map,
        center: latLng,
        radius: 200 // 200 metros de radio
      });

      // Si hacen click derecho en el mismo círculo, se remueve el objetivo
      patrol.targetMarker.addListener('rightclick', () => {
        this.ngZone.run(() => {
          this.removeTargetPoint();
        });
      });

      // Crear línea de ruta
      patrol.routeLine = new google.maps.Polyline({
        path: [patrol.marker.getPosition(), latLng],
        map: this.map,
        strokeColor: '#f44336',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        geodesic: true
      });
    } else {
      // Actualizar destino existente
      patrol.targetMarker.setCenter(latLng);
      patrol.routeLine.setPath([patrol.marker.getPosition(), latLng]);
    }

    this.evaluatePatrolState(patrol);
  }

  removeTargetPoint() {
    const patrol = this.selectedPatrol;
    if (!patrol || !patrol.targetPoint) return;

    // Limpiar elementos visuales del mapa
    if (patrol.targetMarker) {
      patrol.targetMarker.setMap(null);
      patrol.targetMarker = null;
    }
    if (patrol.routeLine) {
      patrol.routeLine.setMap(null);
      patrol.routeLine = null;
    }

    // Reiniciar variables
    patrol.targetPoint = null;
    this.evaluatePatrolState(patrol);
  }

  addPatrol() {
    if (!this.map) return;
    if (this.patrols.length >= 1) {
      this.errorMessage = "Solo se permite 1 patrulla activa en esta demostración.";
      setTimeout(() => this.errorMessage = '', 4000);
      return;
    }
    
    const id = `Z-${Math.floor(Math.random() * 9000) + 1000}`;
    const offsetLat = (Math.random() - 0.5) * 0.01;
    const offsetLng = (Math.random() - 0.5) * 0.01;
    const spawnPos = { lat: this.center.lat + offsetLat, lng: this.center.lng + offsetLng };

    const marker = new google.maps.Marker({
      position: spawnPos,
      map: this.map,
      title: `${id} (Carabineros) - Arrástrame`,
      draggable: true,
      icon: {
        url: 'assets/car.png', 
        scaledSize: new google.maps.Size(70, 70) // Tamaño más grande (70x70) para mantener la nitidez al hacer zoom
      }
    });

    const patrol: Patrol = { id, marker, state: 'Sin destino asignado', statusColor: '#9E9E9E' };
    
    marker.addListener('click', () => {
      this.selectPatrol(id);
    });

    marker.addListener('dragend', () => {
      this.ngZone.run(() => {
        this.selectPatrol(id);
        this.evaluatePatrolState(patrol);
      });
    });

    this.patrols.push(patrol);
    this.selectPatrol(id);
  }

  selectPatrol(id: string) {
    this.selectedPatrolId = id;
    const patrol = this.patrols.find(p => p.id === id);
    if (patrol) {
      this.map.panTo(patrol.marker.getPosition());
    }
  }

  get selectedPatrol(): Patrol | undefined {
    return this.patrols.find(p => p.id === this.selectedPatrolId);
  }

  evaluatePatrolState(patrol: Patrol) {
    try {
      const currentPosition = patrol.marker.getPosition();
      if (!currentPosition) return;

      if (patrol.targetPoint && patrol.routeLine) {
        patrol.routeLine.setPath([currentPosition, patrol.targetPoint]);
        
        const distance = google.maps.geometry.spherical.computeDistanceBetween(currentPosition, patrol.targetPoint);
        
        if (distance <= 200) { 
          patrol.state = '✅ Operativo y en Posición';
          patrol.statusColor = '#4CAF50'; // Verde
        } else {
          patrol.state = `⚠️ ALERTA GRAVE: Fuera de Zona Asignada (${Math.round(distance)}m)`;
          patrol.statusColor = '#f44336'; // Rojo de alerta
        }
      } else {
        patrol.state = 'Inactivo: Sin destino asignado';
        patrol.statusColor = '#9E9E9E'; // Gris
      }
    } catch(err: any) {
      this.errorMessage = "Error evaluando estado: " + err.message;
      patrol.state = 'Error';
    }
  }

  // Controles en pantalla para la patrulla SELECCIONADA
  movePatrol(latOffset: number, lngOffset: number) {
    const patrol = this.selectedPatrol;
    if (!patrol || !patrol.marker) return;
    
    const pos = patrol.marker.getPosition();
    if (pos) {
      const newPos = new google.maps.LatLng(pos.lat() + latOffset, pos.lng() + lngOffset);
      patrol.marker.setPosition(newPos);
      // this.map.panTo(newPos); // Eliminado para que el mapa no te persiga
      this.evaluatePatrolState(patrol);
    }
  }

  // Escuchar teclado para mover patrulla sin hacer scroll
  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (!this.selectedPatrolId) return;

    // Solo reaccionar a flechas
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault(); // Evitar scroll de la página

      const step = 0.0001; // Movimiento corto y preciso (aprox 11 metros por toque)
      switch(event.key) {
        case 'ArrowUp': this.movePatrol(step, 0); break;
        case 'ArrowDown': this.movePatrol(-step, 0); break;
        case 'ArrowLeft': this.movePatrol(0, -step); break;
        case 'ArrowRight': this.movePatrol(0, step); break;
      }
    }
  }
}
