import { Component, OnInit, ViewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { T } from '../../../../translate-marker';

import * as _ from 'lodash';

@Component({
  selector: 'app-rsync',
  templateUrl: './service-rsync.component.html',
})
export class ServiceRSYNCComponent implements OnInit {

  @ViewChild('tabGroup', { static: true}) tabGroup;

  public activedTab = 'Configuration';
  public navLinks: Array < any > = [{
      label: T('Configure'),
      path: '/services/rsync/configure',
    },
    {
      label: T('Rsync Modules'),
      path: '/services/rsync/rsync-module',
    },
  ];
  constructor(protected router: Router, protected aroute: ActivatedRoute, ) {}

  ngOnInit() {
    this.aroute.params.subscribe(params => {
      this.activedTab = params['pk'];
    });
  }

}
