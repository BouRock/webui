import {
  ApplicationRef,
  Component,
  Injector
} from '@angular/core';

import { ActivatedRoute, Router } from '@angular/router';
import * as _ from 'lodash';

import { WebSocketService } from '../../../../services/';
import {
  FieldConfig
} from '../../../common/entity/entity-form/models/field-config.interface';
import { DialogService } from 'app/services/dialog.service';
import { MatSnackBar, MatDialog } from '@angular/material';
import { Formconfiguration } from 'app/pages/common/entity/entity-form/entity-form.component';
import { AppLoaderService } from '../../../../services/app-loader/app-loader.service';
import { T } from '../../../../translate-marker';
import { DownloadKeyModalDialog } from '../../../../components/common/dialog/downloadkey/downloadkey-dialog.component';
import helptext from '../../../../helptext/storage/volumes/volume-key';

@Component({
  selector : 'app-createpassphrase-form',
  template : `<entity-form [conf]="this"></entity-form>`
})
export class VolumeCreatekeyFormComponent implements Formconfiguration {

  saveSubmitText = T("Create Passphrase");

  resource_name = 'storage/volume';
  route_success: string[] = [ 'storage', 'pools'];
  isNew = false;
  isEntity = true;
  entityData = {
    name: "",
    passphrase: "",
    passphrase2: ""
  };

  fieldConfig: FieldConfig[] = [
    {
      type : 'input',
      name : 'name',
      isHidden: true
    },{
      type: 'paragraph',
      name: 'createkey-instructions',
      paraText: helptext.changekey_instructions
    },{
      type : 'input',
      inputType: 'password',
      togglePw : true,
      name : 'adminpw',
      placeholder: helptext.changekey_adminpw_placeholder,
      tooltip: helptext.changekey_adminpw_tooltip,
      validation: helptext.changekey_adminpw_validation,
      required: true
    },{
      type : 'input',
      inputType: 'password',
      name : 'passphrase',
      placeholder: helptext.createkey_passphrase_placeholder,
      tooltip: helptext.createkey_passphrase_tooltip,
      validation: helptext.createkey_passphrase_validation,
      required: true,
      togglePw: true
    },{
      type : 'input',
      inputType: 'password',
      name : 'passphrase2',
      placeholder: helptext.createkey_passphrase2_placeholder,
      tooltip: helptext.createkey_passphrase2_tooltip,
      validation: helptext.createkey_passphrase2_validation,
      required: true
    }
  ];

  resourceTransformIncomingRestData(data:any): any {
    return data;
  };

  pk: any;
  constructor(
      protected router: Router,
      protected route: ActivatedRoute,
      protected ws: WebSocketService,
      protected _injector: Injector,
      protected _appRef: ApplicationRef,
      protected dialogService: DialogService,
      protected loader: AppLoaderService,
      private snackBar: MatSnackBar,
      private mdDialog: MatDialog
  ) {}

  preInit(entityForm: any) {
    this.route.params.subscribe(params => {
      this.pk = params['pk'];
    });
  }

  customSubmit(value) {
    this.loader.open();
    this.ws.call('pool.passphrase', [parseInt(this.pk), {'passphrase': value.passphrase, 
      'admin_password': value.adminpw}]).subscribe((res) => {
        this.loader.close();
        this.snackBar.open(T('Passphrase created for pool ') + value.name, T("Close"), {
          duration: 5000,
        });
        let dialogRef = this.mdDialog.open(DownloadKeyModalDialog, {disableClose:true});
        dialogRef.componentInstance.volumeId = this.pk;
        dialogRef.componentInstance.fileName = 'pool_' + value.name + '_encryption.key';
        dialogRef.afterClosed().subscribe(result => {
          this.router.navigate(new Array('/').concat(
            this.route_success));
        });
        (err) => {
          this.loader.close();
          this.dialogService.errorReport(T("Error creating passphrase for pool ") + value.name, err.error.message, err.error.traceback);
        };
      })
 }

}
