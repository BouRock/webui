import { Component, OnInit, AfterViewInit, OnChanges, SimpleChanges, ViewChild, ElementRef, NgZone, OnDestroy } from '@angular/core';
import { FlexLayoutModule } from '@angular/flex-layout';
import { MaterialModule } from 'app/appMaterial.module';
import { CoreService, CoreEvent } from 'app/core/services/core.service';
import { Application, Container, extras, Text, DisplayObject, Graphics, Sprite, Texture, utils} from 'pixi.js';
//import 'pixi-filters';
import 'pixi-projection';
import { VDevLabelsSVG } from 'app/core/classes/hardware/vdev-labels-svg';
import { DriveTray } from 'app/core/classes/hardware/drivetray';
import { M50 } from 'app/core/classes/hardware/m50';
import { DiskComponent } from './disk.component';
import { SystemProfiler } from './system-profiler';
import { tween, easing, styler } from 'popmotion';
import { ExampleData } from './example-data';
//declare const PIXI: any;

@Component({
  selector: 'enclosure-disks',
  templateUrl: './enclosure-disks.component.html',
  styleUrls: ['./enclosure-disks.component.css']
})

export class EnclosureDisksComponent implements AfterViewInit, OnChanges, OnDestroy {

  @ViewChild('disksoverview') overview: ElementRef;
  @ViewChild('disksdetails') details: ElementRef;
  @ViewChild('domLabels') domLabels: ElementRef;
  public app;
  private renderer;
  private loader = PIXI.loader;
  private resources = PIXI.loader.resources;
  public container;
  public system_product: string = 'unknown';
  public system: SystemProfiler;
  protected enclosure: any; // Visualization
  public selectedEnclosure: any;

  private _expanders: any[] = [];
  get expanders () {
    if(this.system.enclosures){
      let enclosureNumber =  this.selectedEnclosure.disks[0].enclosure.number;
      return this.system.getEnclosureExpanders(enclosureNumber);
    } else {
      return this._expanders;
    }
  }

  private _selectedVdev: any;
  get selectedVdev(){
    return this._selectedVdev;
  }
  set selectedVdev(value) {
    this._selectedVdev = value;
    this.selectedVdevDisks = value && value.disks ? Object.keys(this.selectedVdev.disks) : null;
  }

  get enclosurePools(){
    return Object.keys(this.selectedEnclosure.poolKeys);
  }

  public selectedVdevDisks: string[];
  public selectedDisk: any;

  public theme: any;
  public currentView: string; // pools || status || expanders || details
  public exitingView: string; // pools || status || expanders || details
  private defaultView = 'pools';
  private labels: VDevLabelsSVG;
  
 

  constructor(public el:ElementRef, private core: CoreService /*, private ngZone: NgZone*/) { 

    core.register({observerClass: this, eventName: 'ThemeData'}).subscribe((evt:CoreEvent) => {
      this.theme = evt.data;
    });

    core.register({observerClass: this, eventName: 'ThemeChanged'}).subscribe((evt:CoreEvent) => {
      this.theme = evt.data;
      this.setCurrentView(this.currentView);
    });

    core.register({observerClass: this, eventName: 'EnclosureData'}).subscribe((evt:CoreEvent) => {
      console.log(evt);
      this.system.enclosures = evt.data;
      console.log(this.system);
    });

    core.register({observerClass: this, eventName: 'PoolData'}).subscribe((evt:CoreEvent) => {
      this.system.pools = evt.data;
      //core.emit({name: 'EnclosureDataRequest', sender: this});
    });


    core.register({observerClass: this, eventName: 'DisksData'}).subscribe((evt:CoreEvent) => {
      console.log(evt);
      // SIMULATED DATA
      /*let edata = new ExampleData();
      edata.addEnclosure(24); //  M50 24 slots
      edata.addEnclosure(12); // ES12 12 slots
      let data = edata.generateData();*/
      // END SIMULATED DATA

      let data = evt.data;
      this.system = new SystemProfiler(this.system_product, data);
      this.selectedEnclosure = this.system.profile[0];
      //console.log(this.system);
      core.emit({name: 'PoolDataRequest', sender: this});
      this.pixiInit();
    });

    core.register({observerClass: this, eventName: 'SysInfo'}).subscribe((evt:CoreEvent) => {
      console.log(evt);
      //this.system_product = evt.data.system_product;
      this.system_product = 'M50'; // Just for testing on my FreeNAS box
      //core.emit({name: 'DisksRequest', sender: this});
      core.emit({name: 'EnclosureDataRequest', sender: this});
    });

    core.emit({name: 'ThemeDataRequest', sender: this});
    core.emit({name: 'SysInfoRequest', sender: this});

  }

  clearDisk(){
    this.setCurrentView(this.defaultView);
  }

  ngAfterViewInit() {

    // Listen for DOM changes to avoid race conditions with animations
    let callback = (mutationList, observer) => {
      mutationList.forEach((mutation) => {
        switch(mutation.type) {
          case 'childList':
            /* One or more children have been added to and/or removed
               from the tree; see mutation.addedNodes and
               mutation.removedNodes */
            if(mutation.addedNodes.length == 0 || mutation.addedNodes[0].classList.length == 0){
              break;
            }
            const fullStage: boolean = mutation.addedNodes[0].classList.contains('full-stage');
            const stageLeft: boolean = mutation.addedNodes[0].classList.contains('stage-left');
            const stageRight: boolean = mutation.addedNodes[0].classList.contains('stage-right');
            const vdevLabels: boolean = mutation.addedNodes[0].classList.contains('vdev-disk');
            const canvasClickpad: boolean = mutation.addedNodes[0].classList.contains('clickpad');
            if(stageLeft){
              this.enter('stage-left'); // View has changed so we launch transition animations
            } else if(stageRight){
              this.enter('stage-right'); // View has changed so we launch transition animations
            }  else if(fullStage){
              this.enter('full-stage'); // View has changed so we launch transition animations
            }
            break;
          case 'attributes':
            /* An attribute value changed on the element in
               mutation.target; the attribute name is in
               mutation.attributeName and its previous value is in
               mutation.oldValue */

            const diskName: boolean = mutation.target.classList.contains('disk-name');
        
            if(diskName && this.currentView == 'details' && this.exitingView == 'details'){
              //this.labels.events.next({name:"OverlayReady", data: {vdev: this.selectedVdev, overlay:this.domLabels}, sender: this});
              this.update('stage-right');
            }
            break;
        }
      });
      
    }

    const observerOptions = {
      childList: true,
      attributes: true,
      subtree: true //Omit or set to false to observe only changes to the parent node.
    }
    
    const domChanges = new MutationObserver(callback);
    domChanges.observe(this.overview.nativeElement, observerOptions);

  }

  ngOnChanges(changes:SimpleChanges){
  }

  ngOnDestroy(){
    this.core.unregister({observerClass: this});
    this.destroyEnclosure();
    this.app.stage.destroy(true);
    this.app.destroy(true, true); 
  }

  pixiInit(){
    //this.ngZone.runOutsideAngular(() => {
      PIXI.settings.PRECISION_FRAGMENT = 'highp'; //this makes text looks better? Answer = NO
      PIXI.utils.skipHello();
      this.app = new PIXI.Application({
        width:960 ,
        height:304 ,
        forceCanvas:false,
        transparent:true,
        antialias:true,
        autoStart:true
      });
    //});

    this.renderer = this.app.renderer;

    this.app.renderer.backgroundColor = 0x000000;
    this.overview.nativeElement.appendChild(this.app.view);

    this.container = new PIXI.Container();
    this.container.name = "top_level_container";
    this.app.stage.name = "stage_container";
    this.app.stage.addChild(this.container);
    this.container.width = this.app.stage.width;
    this.container.height = this.app.stage.height;

    this.createEnclosure();
  }

  createEnclosure(){
    this.enclosure = new M50();
    this.enclosure.events.subscribe((evt) => {
      switch(evt.name){
        case "Ready":
          this.container.addChild(this.enclosure.container);
          this.enclosure.container.name = this.enclosure.model;
          this.enclosure.container.width = this.enclosure.container.width / 2;
          this.enclosure.container.height = this.enclosure.container.height / 2;
          this.enclosure.container.x = this.app._options.width / 2 - this.enclosure.container.width / 2;
          this.enclosure.container.y = this.app._options.height / 2 - this.enclosure.container.height / 2;

          this.setDisksEnabledState();
          //this.setDisksDisabled();
          this.setCurrentView(this.defaultView);
          
        break;
        case "DriveSelected":
          let disk = this.selectedEnclosure.disks[evt.data.id]; // should match slot number
          if(disk == this.selectedDisk){break} // Don't trigger any changes if the same disk is selected
          if(this.enclosure.driveTrayObjects[evt.data.id].enabled){
            this.selectedDisk = disk;
            this.setCurrentView('details');
          }
        break;
      }
    });

    if(!this.resources[this.enclosure.model]){
      this.enclosure.load();
    } else {
      this.onImport(); 
    }
  }

  destroyEnclosure(){
    // Clear out assets
    this.enclosure.destroy();
    this.container.destroy(true);
    PIXI.loader.resources = {};
  }

  makeDriveTray():DriveTray{
    let dt = this.enclosure.makeDriveTray();
    return dt;
  }

  importAsset(alias, path){
    // NOTE: Alias will become the property name in resources
    this.loader
      .add(alias, path) //.add("catImage", "assets/res/cat.png")
      .on("progress", this.loadProgressHandler)
      .load(this.onImport.bind(this));
  }

  onImport(){
    let sprite = PIXI.Sprite.from(this.enclosure.loader.resources.m50.texture.baseTexture);
    sprite.x = 0;
    sprite.y = 0;
    sprite.name=this.enclosure.model + "_sprite"
    sprite.alpha = 0.1;
    this.container.addChild(sprite);

    let dt = this.enclosure.makeDriveTray();
    this.container.addChild(dt.container);
    this.setCurrentView(this.defaultView);
    
  }

  loadProgressHandler(loader, resource) {

    // Display the file `url` currently being loaded
    // console.log("loading: " + resource.url);

    // Display the percentage of files currently loaded

    // console.log("progress: " + loader.progress + "%");

    // If you gave your files names as the first argument
    // of the `add` method, you can access them like this

    // console.log("loading: " + resource.name);

  }


  setCurrentView(opt: string){
    console.log(this.system);
    if(this.currentView){ this.exitingView = this.currentView; }
    // pools || status || expanders || details

    if(this.labels){
      // Start exit animation
      this.labels.exit();
    }
    
    switch(opt){
      case 'pools':
        //this.setDisksDisabled();
        this.container.alpha = 1;
        this.setDisksPoolState();
      break
      case 'status':
        this.container.alpha = 1;
        this.setDisksDisabled();
        this.setDisksHealthState();
      break
      case 'expanders':
        this.container.alpha = 0;
      break
      case 'details':
        this.container.alpha = 1;
        this.setDisksDisabled();
        this.setDisksHealthState(this.selectedDisk.enclosure.slot);
        let vdev = this.system.getVdevInfo(this.selectedDisk.devname);
        this.selectedVdev = vdev;

        this.labels = new VDevLabelsSVG(this.enclosure, this.app, this.theme.blue/*, dl*/);

        this.labels.events.next({name:"LabelDrives", data: vdev, sender: this});
        let dl;

      break
    }

    this.currentView = opt;
    
  }

  update(className:string){ // only for details view
 
    let sideStage = this.overview.nativeElement.querySelector('.' + this.currentView + '.' + className);
    let html = this.overview.nativeElement.querySelector('.' + this.currentView + '.' + className + ' .content')
    let el = styler(html);

    let x = (sideStage.offsetWidth * 0.5) - (el.get('width') * 0.5);
    let y = sideStage.offsetTop + (sideStage.offsetHeight * 0.5) - (el.get('height') * 0.5);
    html.style.left = x.toString() + 'px';
    html.style.top = y.toString() + 'px';
    this.labels.events.next({name:"OverlayReady", data: {vdev: this.selectedVdev, overlay:this.domLabels}, sender: this});
  
  }

  enter(className:string){ // stage-left or stage-right or expanders
    if(this.exitingView){ 
      if(className == 'full-stage'){
        this.exit('stage-left'); 
        this.exit('stage-right'); 
      } else if(this.exitingView == 'expanders'){
        this.exit('full-stage'); 
      } else {
        this.exit(className);
      }
    }
    
 
    let sideStage = this.overview.nativeElement.querySelector('.' + this.currentView + '.' + className);
    let html = this.overview.nativeElement.querySelector('.' + this.currentView + '.' + className + ' .content')
    let el = styler(html);

    let x = (sideStage.offsetWidth * 0.5) - (el.get('width') * 0.5);
    let y = sideStage.offsetTop + (sideStage.offsetHeight * 0.5) - (el.get('height') * 0.5);
    html.style.left = x.toString() + 'px';
    html.style.top = y.toString() + 'px';
    
    tween({
      from:{ scale: 0, opacity: 0},
      to:{scale: 1, opacity: 1},
      duration: 360
    }).start({
      update: v => { el.set(v); },
      complete: () => {
        if(this.currentView == 'details'){
          this.labels.events.next({name:"OverlayReady", data: {vdev: this.selectedVdev, overlay:this.domLabels}, sender: this});
        }
      }
    });
  }

  exit(className){ // stage-left or stage-right or full-stage
    let html = this.overview.nativeElement.querySelector('.' + className + '.' + this.exitingView);
    let el = styler(html);
    let duration = 360;

    // x is the position relative to it's starting point.
    const w = el.get('width');
    const startX = 0;
    let endX = className == 'stage-left' ? w * -1 : w;
    if(className == 'full-stage'){ 
      endX = startX;
      duration = 10;
    }

    // Move stage left
    tween({
      from:{opacity:1, x:0},
      to:{
        opacity:0,
        x: endX
      },
      duration: duration
    }).start({
      update: v => { el.set(v) },
      complete: () => {
        if(this.exitingView == 'details' && this.currentView !== 'details'){
          this.selectedDisk = null;
          this.labels = null;
          this.selectedVdev = null;
        }
        this.exitingView = null;
        el.set({x: 0})
      }
    });

  }

  setDisksEnabledState(){
    this.enclosure.driveTrayObjects.forEach((dt, index) =>{
      let disk = this.selectedEnclosure.disks[index];
      dt.enabled = disk ? true : false;
    });
  }

  setDisksDisabled(){
    this.enclosure.driveTrayObjects.forEach((dt, index) =>{
      let disk = this.selectedEnclosure.disks[index];
      this.enclosure.events.next({name:"ChangeDriveTrayColor", data:{id: index, color: 'none'}});
    });
  }

  setDisksHealthState(slot?: number){ // Give it a slot number and it will only change that slot

    if(slot || typeof slot !== 'undefined'){
      this.setDiskHealthState(slot - 1); // Enclosure slot numbers start at 1
      return;
    }

    this.enclosure.driveTrayObjects.forEach((dt, index) =>{
      this.setDiskHealthState(index)
    });

  }

  setDiskHealthState(index: number){

      let disk = this.selectedEnclosure.disks[index];
      this.enclosure.driveTrayObjects[index].enabled = disk ? true : false;

      if(disk && disk.status){
        switch(disk.status){
          case "ONLINE":
            this.enclosure.events.next({name:"ChangeDriveTrayColor", data:{id: index, color: this.theme.green}});
          break;
          case "FAULT":
            this.enclosure.events.next({name:"ChangeDriveTrayColor", data:{id: index, color: this.theme.red}});
          break;
          case "AVAILABLE":
            this.enclosure.events.next({name:"ChangeDriveTrayColor", data:{id: index, color: '#999999'}});
          break;
          default:
            this.enclosure.events.next({name:"ChangeDriveTrayColor", data:{id: index, color: this.theme.yellow}});
          break
        }

      }
  }

  setDisksPoolState(){
    this.setDisksDisabled();
    let keys = Object.keys(this.selectedEnclosure.poolKeys);
    if(keys.length > 0){
      this.selectedEnclosure.disks.forEach((disk, index) => {
        if(disk.vdev){
          let pIndex = disk.vdev.poolIndex;
          this.enclosure.events.next({name:"ChangeDriveTrayColor", data:{id: index, color: this.theme[this.theme.accentColors[pIndex]]}});
        }
      });
    } else {
      return;
    }
  }

  converter(size: number){
    let gb = size / 1024 / 1024/ 1024;
    if(gb > 1000){
      let tb = gb / 1024;
      return tb.toFixed(2) + " TB";
    } else {
      return gb.toFixed(2) + " GB";
    }
  }

}
